import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import OpenAI from 'openai';
import { query, queryOne } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../middleware/logger';
import { aiLimiter } from '../middleware/rateLimit';
import { reserveDailyAiMessage } from '../services/aiUsageService';
import {
  MAX_CONTEXT_FIELD_LENGTH,
  MAX_FULL_NAME_LENGTH,
  buildChatMessages,
  sanitizeUserText,
} from '../lib/aiPrompt';

const router = Router();
router.use(authenticate);

function getOpenAI(): OpenAI | null {
  const key = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

const SYSTEM_PROMPT = `You are CardXC Assistant, a helpful AI support agent for CardXC - a digital payment platform for virtual cards and money transfers.

You can help users with:
- Understanding their account balance and transactions
- Virtual card management (creating cards, checking limits, freezing cards)
- Transfers and payments (P2P transfers, payment links, QR payments)
- Savings vaults and budgeting
- Security questions (2FA, sessions, account protection)
- KYC verification process
- General platform navigation

Guidelines:
- Be concise, friendly, and professional
- Never share sensitive information like full card numbers
- For complex issues, suggest contacting support
- If asked to perform actions, explain how the user can do it in the app
- Don't make up information - if unsure, say so
- Format responses nicely with bullet points when listing items`;

router.get('/conversations', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const conversations = await query(`
    SELECT id, title, created_at, updated_at
    FROM ai_conversations
    WHERE user_id = $1
    ORDER BY updated_at DESC
    LIMIT 50
  `, [req.user!.id]);

  res.json({ success: true, data: { conversations } });
}));

router.post('/conversations',
  body('title').optional().trim().isLength({ max: 100 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { title } = req.body;
    
    const result = await queryOne(`
      INSERT INTO ai_conversations (user_id, title)
      VALUES ($1, $2)
      RETURNING id, title, created_at
    `, [req.user!.id, title || 'New Chat']);

    res.status(201).json({ success: true, data: { conversation: result } });
  })
);

router.get('/conversations/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const conversation = await queryOne(`
    SELECT id, title, created_at FROM ai_conversations
    WHERE id = $1 AND user_id = $2
  `, [id, req.user!.id]);

  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }

  const messages = await query(`
    SELECT id, role, content, created_at
    FROM ai_messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC
  `, [id]);

  res.json({ success: true, data: { conversation, messages } });
}));

router.delete('/conversations/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  await query(`
    DELETE FROM ai_conversations
    WHERE id = $1 AND user_id = $2
  `, [id, req.user!.id]);

  res.json({ success: true, message: 'Conversation deleted' });
}));

router.post('/conversations/:id/messages',
  // CSO #5: per-user burst limit. The generic apiLimiter is per-IP, which does
  // not bound spend that is billed per user against the platform's own key.
  aiLimiter,
  body('content').trim().notEmpty().isLength({ max: 4000 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { id } = req.params;
    const { content } = req.body;

    const conversation = await queryOne(`
      SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2
    `, [id, req.user!.id]);

    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    // Resolve the upstream client BEFORE reserving budget: if the platform key
    // is unset there will be no paid call, so charging a daily unit would burn
    // every user's allowance on a misconfigured deployment.
    const client = getOpenAI();
    if (!client) {
      throw new AppError(
        'AI not configured. Set AI_INTEGRATIONS_OPENAI_API_KEY.',
        503,
        'AI_NOT_CONFIGURED',
      );
    }

    // CSO #5: claim one unit of the daily budget AND persist the message in a
    // single advisory-locked transaction, before the paid API is contacted. A
    // check-then-insert here was a TOCTOU: concurrent requests all read the same
    // pre-insert count and all passed. Fails closed if it cannot run.
    await reserveDailyAiMessage(req.user!.id, id as string, content);

    const existingMessages = await query<{ role: string; content: string }>(`
      SELECT role, content FROM ai_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT 20
    `, [id]);

    const userContext = await getUserContext(req.user!.id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // CSO #5: a disconnecting client must stop the metered upstream call. Without
    // this the for-await loop below keeps draining (and billing) the stream into
    // a dead socket. Listeners are removed in `finally` so they cannot accumulate.
    const abortController = new AbortController();

    // Only `res` close is a trustworthy disconnect signal. On Node >=16 the
    // REQUEST emits 'close' once its body has been fully consumed — which
    // express.json() has already done by the time this handler runs — so
    // listening on `req` would abort perfectly healthy requests depending on
    // timing. `res` close also fires after a normal res.end(), hence the
    // writableEnded guard: only a close BEFORE we finished writing means the
    // client actually went away.
    const onClientGone = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };
    // A destroyed socket emits 'error' on the response. With no listener that
    // becomes an unhandled error event and can take the process down — remotely
    // triggerable by dropping the socket mid-stream.
    //
    // This listener is deliberately NOT removed in `finally`: socket errors are
    // emitted asynchronously (ECONNRESET / ERR_STREAM_DESTROYED land on a later
    // tick, after res.end() has returned), so detaching it synchronously would
    // leave exactly those errors unhandled. It is one listener bound to a single
    // response object, which is released with the request — not a leak.
    res.on('error', () => {});
    res.on('close', onClientGone);

    try {
      // CSO #4: the system slot holds SYSTEM_PROMPT and nothing else. Account
      // context (which contains attacker-writable fields such as full_name,
      // card names and vault names) travels in a separate fenced non-system
      // message so it cannot overwrite the assistant's instructions.
      const chatMessages = buildChatMessages(
        SYSTEM_PROMPT,
        userContext,
        existingMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ) as OpenAI.ChatCompletionMessageParam[];

      const stream = await client.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: chatMessages,
          stream: true,
          max_completion_tokens: 1024,
        },
        { signal: abortController.signal },
      );

      let fullResponse = '';

      for await (const chunk of stream) {
        // Belt and braces alongside the AbortSignal: stop on the next chunk
        // boundary even if the SDK has not yet torn the connection down.
        if (abortController.signal.aborted) break;

        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      if (abortController.signal.aborted) {
        // The client is gone and the reply is truncated. Persisting it would
        // record a fabricated assistant turn the user never saw, which would
        // then be replayed as context on the next request.
        //
        // The reserved budget unit is deliberately NOT refunded: refunding on
        // disconnect would let a client stream-and-drop indefinitely for free
        // upstream tokens. Pinned by aiStreamAbort.test.ts.
        (stream as { controller?: AbortController })?.controller?.abort();
        logger.info('[AI] Client disconnected mid-stream; upstream aborted', {
          userId: req.user!.id,
          conversationId: id,
        });
        if (!res.destroyed && !res.writableEnded) res.end();
        return;
      }

      await query(`
        INSERT INTO ai_messages (conversation_id, role, content)
        VALUES ($1, 'assistant', $2)
      `, [id, fullResponse]);

      await query(`
        UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1
      `, [id]);

      // Re-check AFTER the awaits above: the client can disconnect while those
      // writes are in flight, and writing to a destroyed socket raises an
      // unhandled 'error'. The rows are already persisted, which is correct —
      // only the delivery is skipped.
      if (abortController.signal.aborted || res.destroyed || res.writableEnded) {
        return;
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      // An abort is the expected consequence of the client leaving, not a fault.
      if (abortController.signal.aborted) {
        logger.info('[AI] Stream aborted after client disconnect', {
          userId: req.user!.id,
          conversationId: id,
        });
        if (!res.destroyed && !res.writableEnded) res.end();
        return;
      }
      logger.error('AI chat error:', error);
      if (res.destroyed || res.writableEnded) {
        return;
      }
      res.write(`data: ${JSON.stringify({ error: 'Failed to get AI response' })}\n\n`);
      res.end();
    } finally {
      // Detach the disconnect listener; the 'error' listener intentionally stays
      // for the response's lifetime (see the note where it is attached).
      res.removeListener('close', onClientGone);
    }
  })
);

async function getUserContext(userId: string): Promise<string> {
  const user = await queryOne<any>(`
    SELECT full_name, email, kyc_status, two_factor_enabled, created_at
    FROM users WHERE id = $1
  `, [userId]);

  const wallets = await query<any>(`
    SELECT currency, balance_cents FROM wallets WHERE user_id = $1
  `, [userId]);

  const recentTx = await query<any>(`
    SELECT type, amount_cents, currency, status, created_at
    FROM transactions WHERE user_id = $1
    ORDER BY created_at DESC LIMIT 5
  `, [userId]);

  const cards = await query<any>(`
    SELECT card_name, status, balance_cents FROM virtual_cards WHERE user_id = $1
  `, [userId]);

  const vaults = await query<any>(`
    SELECT name, target_cents, balance_cents FROM savings_vaults WHERE user_id = $1
  `, [userId]);

  // CSO #4: full_name, card_name and vault name are all user-writable free text.
  // Flatten and cap them before interpolation so a stored value cannot forge a
  // line break or a new section inside the context block.
  const displayName = sanitizeUserText(user?.full_name, MAX_FULL_NAME_LENGTH) || 'Unknown';

  let context = `User: ${displayName}\n`;
  context += `KYC Status: ${user?.kyc_status || 'pending'}\n`;
  context += `2FA: ${user?.two_factor_enabled ? 'Enabled' : 'Disabled'}\n\n`;

  if (wallets.length > 0) {
    context += 'Wallet Balances:\n';
    wallets.forEach((w: any) => {
      context += `- ${w.currency}: ${(Number(w.balance_cents) / 100).toFixed(2)}\n`;
    });
    context += '\n';
  }

  if (cards.length > 0) {
    context += `Virtual Cards: ${cards.length} card(s)\n`;
    cards.forEach((c: any) => {
      const cardName = sanitizeUserText(c.card_name, MAX_CONTEXT_FIELD_LENGTH) || 'Unnamed card';
      context += `- ${cardName}: ${c.status}, Balance: ${(Number(c.balance_cents) / 100).toFixed(2)}\n`;
    });
    context += '\n';
  }

  if (vaults.length > 0) {
    context += `Savings Vaults: ${vaults.length}\n`;
    vaults.forEach((v: any) => {
      const progress = v.target_cents > 0 ? Math.round((v.balance_cents / v.target_cents) * 100) : 0;
      const vaultName = sanitizeUserText(v.name, MAX_CONTEXT_FIELD_LENGTH) || 'Unnamed vault';
      context += `- ${vaultName}: ${(Number(v.balance_cents) / 100).toFixed(2)} / ${(Number(v.target_cents) / 100).toFixed(2)} (${progress}%)\n`;
    });
    context += '\n';
  }

  if (recentTx.length > 0) {
    context += 'Recent Transactions:\n';
    recentTx.forEach((tx: any) => {
      context += `- ${tx.type}: ${(Number(tx.amount_cents) / 100).toFixed(2)} ${tx.currency} (${tx.status})\n`;
    });
  }

  return context;
}

export { router as aiRouter };
