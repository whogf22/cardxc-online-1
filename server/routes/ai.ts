import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import OpenAI from 'openai';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../middleware/logger';

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

    await query(`
      INSERT INTO ai_messages (conversation_id, role, content)
      VALUES ($1, 'user', $2)
    `, [id, content]);

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

    try {
      const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT + '\n\nUser Context:\n' + userContext },
        ...existingMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      const client = getOpenAI();
      if (!client) {
        res.write(`data: ${JSON.stringify({ error: 'AI not configured. Set AI_INTEGRATIONS_OPENAI_API_KEY.' })}\n\n`);
        res.end();
        return;
      }
      const stream = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 1024,
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      await query(`
        INSERT INTO ai_messages (conversation_id, role, content)
        VALUES ($1, 'assistant', $2)
      `, [id, fullResponse]);

      await query(`
        UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1
      `, [id]);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      logger.error('AI chat error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Failed to get AI response' })}\n\n`);
      res.end();
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

  let context = `User: ${user?.full_name || 'Unknown'}\n`;
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
      context += `- ${c.card_name}: ${c.status}, Balance: ${(Number(c.balance_cents) / 100).toFixed(2)}\n`;
    });
    context += '\n';
  }

  if (vaults.length > 0) {
    context += `Savings Vaults: ${vaults.length}\n`;
    vaults.forEach((v: any) => {
      const progress = v.target_cents > 0 ? Math.round((v.balance_cents / v.target_cents) * 100) : 0;
      context += `- ${v.name}: ${(Number(v.balance_cents) / 100).toFixed(2)} / ${(Number(v.target_cents) / 100).toFixed(2)} (${progress}%)\n`;
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
