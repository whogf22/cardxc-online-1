import { AppError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';

const FLUZ_GRAPHQL_URL =
  process.env.FLUZ_GRAPHQL_URL ||
  (process.env.FLUZ_BASE_URL?.includes('staging')
    ? 'https://api-adapter.staging.fluzapp.com/graphql'
    : 'https://api.fluzapp.com/graphql');

const FLUZ_API_KEY = process.env.FLUZ_API_KEY;
const FLUZ_USER_ID = process.env.FLUZ_USER_ID;
const FLUZ_BUSINESS_ACCOUNT_ID = process.env.FLUZ_BUSINESS_ACCOUNT_ID;

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;
let lastAuthFailure: number = 0;
const AUTH_FAILURE_COOLDOWN = 60_000;

export interface FluzBalanceDetail {
  available: number;
  pending?: number;
}

export interface FluzBankCard {
  bankCardId: string;
  last4: string;
  status: string;
  cardType: string;
}

export interface FluzBankAccount {
  bankAccountId: string;
  accountName: string;
  status: string;
}

export interface FluzWallet {
  bankCards: FluzBankCard[];
  bankAccounts: FluzBankAccount[];
  balances: {
    rewardsBalance: FluzBalanceDetail;
    cashBalance: FluzBalanceDetail;
    giftCardCashBalance: { available: number };
  };
}

export interface FluzVirtualCard {
  virtualCardId: string;
  userId: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  virtualCardLast4: string;
  status: string;
  cardType: string;
  initialAmount: number;
  usedAmount: number;
  createdAt: string;
}

export interface FluzRevealedCard {
  cardNumber: string;
  expiryMMYY: string;
  cvv: string;
  cardHolderName: string;
  billingAddress: {
    streetAddress: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

export interface FluzLockResult {
  virtualCardId: string;
  locked: boolean;
}

export interface FluzEditResult {
  virtualCardId: string;
  status: string;
  cardholderName: string;
}

export interface FluzDepositResult {
  cashBalanceDeposits: Array<{
    depositId: string;
    amount: number;
    status: string;
  }>;
  balances: {
    rewardsBalance: number;
    cashBalance: number;
    fluzPrepaymentBalance: number;
    reserveBalance: number;
  };
}

export interface FluzGiftCardPurchase {
  purchaseId: string;
  purchaseAmount: number;
  giftCard: {
    giftCardId: string;
    status: string;
    offer: {
      offerId: string;
      name: string;
    };
  };
}

export interface FluzOffer {
  offerId: string;
  name: string;
  category?: string;
  logoUrl?: string;
}

export type SpendLimitDuration =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'ANNUAL'
  | 'LIFETIME';

export type FundingSource = 'FLUZ_BALANCE';

export interface CreateVirtualCardInput {
  spendLimit: number;
  spendLimitDuration: SpendLimitDuration;
  cardNickname?: string;
  primaryFundingSource?: FundingSource;
  idempotencyKey?: string;
  lockDate?: string;
  lockCardNextUse?: boolean;
}

export interface EditVirtualCardInput {
  virtualCardId: string;
  spendLimit?: number;
  spendLimitDuration?: SpendLimitDuration;
  cardNickname?: string;
  lockDate?: string;
  lockCardNextUse?: boolean;
}

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, any> }>;
}

export function isConfigured(): boolean {
  return !!(FLUZ_API_KEY && FLUZ_USER_ID && FLUZ_BUSINESS_ACCOUNT_ID);
}

async function graphqlRequest<T = any>(
  query: string,
  variables: Record<string, any> | undefined,
  authHeader: string,
  operationName?: string
): Promise<T> {
  const body: Record<string, any> = { query };
  if (variables) body.variables = variables;
  if (operationName) body.operationName = operationName;

  const response = await fetch(FLUZ_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    logger.error('Card provider GraphQL HTTP error', {
      status: response.status,
      errorPreview: errorText.substring(0, 500),
      operationName,
    });
    throw new AppError(
      'Card service request failed. Please try again later.',
      response.status,
      'PROVIDER_API_HTTP_ERROR'
    );
  }

  const json: GraphQLResponse<T> = await response.json();

  if (json.errors && json.errors.length > 0) {
    const firstError = json.errors[0];
    logger.error('Card provider GraphQL error', {
      message: firstError.message,
      extensions: firstError.extensions,
      operationName,
    });
    throw new AppError(
      'Card service encountered an error. Please try again.',
      400,
      'PROVIDER_GRAPHQL_ERROR'
    );
  }

  if (!json.data) {
    throw new AppError('Card service returned empty data', 502, 'PROVIDER_EMPTY_RESPONSE');
  }

  return json.data;
}

function buildBasicAuthHeader(): string {
  if (!FLUZ_API_KEY) {
    throw new AppError('Card provider not configured', 500, 'PROVIDER_NOT_CONFIGURED');
  }

  const cleanKey = FLUZ_API_KEY.trim();

  if (cleanKey.toLowerCase().startsWith('basic basic')) {
    return `Basic ${cleanKey.substring(6).trim()}`;
  }

  if (cleanKey.toLowerCase().startsWith('basic ')) {
    return cleanKey;
  }

  if (cleanKey.includes(':')) {
    const encoded = Buffer.from(cleanKey).toString('base64');
    return `Basic ${encoded}`;
  }

  return `Basic ${cleanKey}`;
}

export async function generateAccessToken(): Promise<string> {
  if (!FLUZ_API_KEY) {
    throw new AppError('Card provider not configured', 500, 'PROVIDER_NOT_CONFIGURED');
  }

  if (!FLUZ_USER_ID || !FLUZ_BUSINESS_ACCOUNT_ID) {
    throw new AppError('Card provider user/account credentials not configured', 500, 'PROVIDER_NOT_CONFIGURED');
  }

  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  if (lastAuthFailure > 0 && now - lastAuthFailure < AUTH_FAILURE_COOLDOWN) {
    throw new AppError('Card service temporarily unavailable', 503, 'PROVIDER_AUTH_COOLDOWN');
  }

  const authHeader = buildBasicAuthHeader();
  logger.info('Card provider: generating new access token');

  const query = `mutation generateUserAccessToken($input: GenerateUserAccessTokenInput!) {
  generateUserAccessToken(input: $input) {
    accessToken
    expiresAt
  }
}`;

  const variables = {
    input: {
      userId: FLUZ_USER_ID,
      accountId: FLUZ_BUSINESS_ACCOUNT_ID,
      scopes: ['VIRTUAL_CARD_READ', 'VIRTUAL_CARD_WRITE', 'WALLET_READ', 'WALLET_WRITE', 'PURCHASE_READ', 'PURCHASE_WRITE'],
    },
  };

  let data;
  try {
    data = await graphqlRequest<{
      generateUserAccessToken: { accessToken: string; expiresAt: string };
    }>(query, variables, authHeader, 'generateUserAccessToken');
  } catch (err: any) {
    if (err?.statusCode === 401 || err?.message?.includes('401')) {
      lastAuthFailure = Date.now();
      logger.error('Card provider auth failed - will retry after cooldown', {
        cooldownMs: AUTH_FAILURE_COOLDOWN,
      });
    }
    throw err;
  }

  lastAuthFailure = 0;
  const { accessToken, expiresAt } = data.generateUserAccessToken;
  cachedToken = accessToken;
  tokenExpiresAt = new Date(expiresAt).getTime();

  logger.info('Card provider: access token generated', {
    expiresAt,
  });

  return accessToken;
}

async function authenticatedRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  operationName?: string
): Promise<T> {
  const token = await generateAccessToken();
  try {
    return await graphqlRequest<T>(query, variables, `Bearer ${token}`, operationName);
  } catch (err: any) {
    if (
      err?.statusCode === 401 ||
      err?.message?.toLowerCase().includes('unauthorized') ||
      err?.message?.toLowerCase().includes('token expired')
    ) {
      logger.info('Card provider: token expired, refreshing');
      cachedToken = null;
      tokenExpiresAt = 0;
      const newToken = await generateAccessToken();
      return graphqlRequest<T>(query, variables, `Bearer ${newToken}`, operationName);
    }
    throw err;
  }
}

export async function getWallet(): Promise<FluzWallet> {
  logger.info('Card provider: getWallet');

  const query = `query {
  getWallet {
    bankCards { bankCardId last4 status cardType }
    bankAccounts { bankAccountId accountName status }
    balances {
      rewardsBalance { available pending }
      cashBalance { available pending }
      giftCardCashBalance { available }
    }
  }
}`;

  const data = await authenticatedRequest<{ getWallet: FluzWallet }>(query, undefined, 'getWallet');
  return data.getWallet;
}

export async function depositCashBalance(
  amount: number,
  bankCardId: string,
  idempotencyKey?: string
): Promise<FluzDepositResult> {
  logger.info('Card provider: depositCashBalance', { amount });

  const query = `mutation depositCashBalance($input: DepositCashBalanceInput!) {
  depositCashBalance(input: $input) {
    cashBalanceDeposits {
      depositId
      amount
      status
    }
    balances {
      rewardsBalance
      cashBalance
      fluzPrepaymentBalance
      reserveBalance
    }
  }
}`;

  const input: Record<string, any> = { amount, bankCardId };
  if (idempotencyKey) input.idempotencyKey = idempotencyKey;

  const data = await authenticatedRequest<{ depositCashBalance: FluzDepositResult }>(
    query,
    { input },
    'depositCashBalance'
  );
  return data.depositCashBalance;
}

export async function createVirtualCard(input: CreateVirtualCardInput): Promise<FluzVirtualCard> {
  logger.info('Card provider: createVirtualCard', {
    spendLimit: input.spendLimit,
    spendLimitDuration: input.spendLimitDuration,
    cardNickname: input.cardNickname,
  });

  const query = `mutation createVirtualCard($input: CreateVirtualCardInput!) {
  createVirtualCard(input: $input) {
    virtualCardId
    userId
    cardholderName
    expiryMonth
    expiryYear
    virtualCardLast4
    status
    cardType
    initialAmount
    usedAmount
    createdAt
  }
}`;

  const variables: Record<string, any> = {
    spendLimit: input.spendLimit,
    spendLimitDuration: input.spendLimitDuration,
  };
  if (input.cardNickname) variables.cardNickname = input.cardNickname;
  if (input.primaryFundingSource) variables.primaryFundingSource = input.primaryFundingSource;
  if (input.idempotencyKey) variables.idempotencyKey = input.idempotencyKey;
  if (input.lockDate) variables.lockDate = input.lockDate;
  if (input.lockCardNextUse !== undefined) variables.lockCardNextUse = input.lockCardNextUse;

  const data = await authenticatedRequest<{ createVirtualCard: FluzVirtualCard }>(
    query,
    { input: variables },
    'createVirtualCard'
  );
  return data.createVirtualCard;
}

export async function listVirtualCards(): Promise<FluzVirtualCard[]> {
  logger.info('Card provider: listVirtualCards via getUserPurchases');

  const query = `query getUserPurchases($input: GetUserPurchasesInput!) {
  getUserPurchases(input: $input) {
    purchases {
      virtualCard {
        virtualCardId
        userId
        cardholderName
        expiryMonth
        expiryYear
        virtualCardLast4
        status
        cardType
        initialAmount
        usedAmount
        createdAt
      }
    }
  }
}`;

  const data = await authenticatedRequest<{
    getUserPurchases: {
      purchases: Array<{
        virtualCard?: FluzVirtualCard;
      }>;
    };
  }>(
    query,
    { input: { purchaseType: 'VIRTUAL_CARD' } },
    'getUserPurchases'
  );

  return (data.getUserPurchases.purchases || [])
    .map(p => p.virtualCard)
    .filter((card): card is FluzVirtualCard => !!card);
}

export async function getVirtualCardDetails(virtualCardId: string): Promise<FluzVirtualCard> {
  logger.info('Card provider: getVirtualCardDetails via getUserPurchases', { virtualCardId });

  const query = `query getUserPurchases($input: GetUserPurchasesInput!) {
  getUserPurchases(input: $input) {
    purchases {
      virtualCard {
        virtualCardId
        userId
        cardholderName
        expiryMonth
        expiryYear
        virtualCardLast4
        status
        cardType
        initialAmount
        usedAmount
        createdAt
      }
    }
  }
}`;

  const data = await authenticatedRequest<{
    getUserPurchases: {
      purchases: Array<{
        virtualCard?: FluzVirtualCard;
      }>;
    };
  }>(
    query,
    { input: { purchaseType: 'VIRTUAL_CARD', virtualCardId } },
    'getUserPurchases'
  );

  const cards = (data.getUserPurchases.purchases || [])
    .map(p => p.virtualCard)
    .filter((card): card is FluzVirtualCard => !!card && card.virtualCardId === virtualCardId);

  if (cards.length === 0) {
    throw new AppError('Card not found', 404, 'CARD_NOT_FOUND');
  }

  return cards[0];
}

export async function revealVirtualCard(virtualCardId: string): Promise<FluzRevealedCard> {
  logger.info('Card provider: revealVirtualCard', { virtualCardId });

  const query = `mutation revealVirtualCardByVirtualCardId($input: RevealVirtualCardInput!) {
  revealVirtualCardByVirtualCardId(input: $input) {
    cardNumber
    expiryMMYY
    cvv
    cardHolderName
    billingAddress {
      streetAddress
      city
      state
      postalCode
    }
  }
}`;

  const data = await authenticatedRequest<{
    revealVirtualCardByVirtualCardId: FluzRevealedCard;
  }>(query, { input: { virtualCardId } }, 'revealVirtualCardByVirtualCardId');
  return data.revealVirtualCardByVirtualCardId;
}

export async function lockVirtualCard(virtualCardId: string): Promise<FluzLockResult> {
  logger.info('Card provider: lockVirtualCard', { virtualCardId });

  const query = `mutation lockVirtualCard($input: LockVirtualCardInput!) {
  lockVirtualCard(input: $input) {
    virtualCardId
    locked
  }
}`;

  const data = await authenticatedRequest<{ lockVirtualCard: FluzLockResult }>(
    query,
    { input: { virtualCardId } },
    'lockVirtualCard'
  );
  return data.lockVirtualCard;
}

export async function unlockVirtualCard(virtualCardId: string): Promise<FluzLockResult> {
  logger.info('Card provider: unlockVirtualCard', { virtualCardId });

  const query = `mutation unlockVirtualCard($input: UnlockVirtualCardInput!) {
  unlockVirtualCard(input: $input) {
    virtualCardId
    locked
  }
}`;

  const data = await authenticatedRequest<{ unlockVirtualCard: FluzLockResult }>(
    query,
    { input: { virtualCardId } },
    'unlockVirtualCard'
  );
  return data.unlockVirtualCard;
}

export async function editVirtualCard(
  virtualCardId: string,
  updates: Omit<EditVirtualCardInput, 'virtualCardId'>
): Promise<FluzEditResult> {
  logger.info('Card provider: editVirtualCard', { virtualCardId });

  const query = `mutation editVirtualCard($input: EditVirtualCardInput!) {
  editVirtualCard(input: $input) {
    virtualCardId
    status
    cardholderName
  }
}`;

  const data = await authenticatedRequest<{ editVirtualCard: FluzEditResult }>(
    query,
    { input: { virtualCardId, ...updates } },
    'editVirtualCard'
  );
  return data.editVirtualCard;
}

export async function purchaseGiftCard(
  offerId: string,
  amount: number,
  idempotencyKey?: string
): Promise<FluzGiftCardPurchase> {
  logger.info('Card provider: purchaseGiftCard', { offerId, amount });

  const query = `mutation purchaseGiftCard($input: PurchaseGiftCardInput!) {
  purchaseGiftCard(input: $input) {
    purchaseId
    purchaseAmount
    giftCard {
      giftCardId
      status
      offer { offerId name }
    }
  }
}`;

  const input: Record<string, any> = { offerId, amount };
  if (idempotencyKey) input.idempotencyKey = idempotencyKey;

  const data = await authenticatedRequest<{ purchaseGiftCard: FluzGiftCardPurchase }>(
    query,
    { input },
    'purchaseGiftCard'
  );
  return data.purchaseGiftCard;
}

export async function listOffers(): Promise<FluzOffer[]> {
  logger.info('Card provider: listOffers');

  const query = `query {
  getOffers {
    offerId
    name
    category
    logoUrl
  }
}`;

  const data = await authenticatedRequest<{ getOffers: FluzOffer[] }>(
    query,
    undefined,
    'getOffers'
  );
  return data.getOffers;
}

export interface FluzTransaction {
  transactionId: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  description?: string;
  merchantName?: string;
  createdAt: string;
  virtualCardId?: string;
  giftCardId?: string;
}

export interface FluzMerchant {
  merchantId: string;
  name: string;
  description?: string;
  category?: string;
  logoUrl?: string;
  cashbackPercentage?: number;
  status: string;
}

export interface FluzBusinessCategory {
  categoryId: string;
  name: string;
  subCategories?: Array<{ categoryId: string; name: string }>;
}

export interface FluzAddress {
  addressId: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface FluzReferralInfo {
  referralCode: string;
  referralUrl: string;
  totalReferrals: number;
  totalRewards: number;
}

export interface FluzOfferQuote {
  offerId: string;
  merchantName: string;
  originalPrice: number;
  discountedPrice: number;
  cashbackAmount: number;
  validUntil: string;
}

// Get transaction history
export async function getTransactions(filters?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<FluzTransaction[]> {
  logger.info('Card provider: getTransactions', filters);

  const query = `query getTransactions($input: GetTransactionsInput) {
  getTransactions(input: $input) {
    transactionId
    amount
    currency
    type
    status
    description
    merchantName
    createdAt
    virtualCardId
    giftCardId
  }
}`;

  const input: Record<string, any> = {};
  if (filters?.startDate) input.startDate = filters.startDate;
  if (filters?.endDate) input.endDate = filters.endDate;
  if (filters?.limit) input.limit = filters.limit;
  if (filters?.offset) input.offset = filters.offset;

  const data = await authenticatedRequest<{ getTransactions: FluzTransaction[] }>(
    query,
    Object.keys(input).length > 0 ? { input } : undefined,
    'getTransactions'
  );
  return data.getTransactions || [];
}

// Get virtual card transactions
export async function getVirtualCardTransactions(
  virtualCardIds: string[],
  filters?: { startDate?: string; endDate?: string }
): Promise<FluzTransaction[]> {
  logger.info('Card provider: getVirtualCardTransactions', { cardCount: virtualCardIds.length });

  const query = `query getVirtualCardTransactions($input: GetVirtualCardTransactionsInput!) {
  getVirtualCardTransactions(input: $input) {
    transactionId
    amount
    currency
    type
    status
    description
    merchantName
    createdAt
    virtualCardId
  }
}`;

  const input: Record<string, any> = { virtualCardIds };
  if (filters?.startDate) input.startDate = filters.startDate;
  if (filters?.endDate) input.endDate = filters.endDate;

  const data = await authenticatedRequest<{ getVirtualCardTransactions: FluzTransaction[] }>(
    query,
    { input },
    'getVirtualCardTransactions'
  );
  return data.getVirtualCardTransactions || [];
}

// Get merchants with filtering
export async function getMerchants(filters?: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<FluzMerchant[]> {
  logger.info('Card provider: getMerchants', filters);

  const query = `query getMerchants($input: GetMerchantsInput) {
  getMerchants(input: $input) {
    merchantId
    name
    description
    category
    logoUrl
    cashbackPercentage
    status
  }
}`;

  const input: Record<string, any> = {};
  if (filters?.category) input.category = filters.category;
  if (filters?.search) input.search = filters.search;
  if (filters?.limit) input.limit = filters.limit;

  const data = await authenticatedRequest<{ getMerchants: FluzMerchant[] }>(
    query,
    Object.keys(input).length > 0 ? { input } : undefined,
    'getMerchants'
  );
  return data.getMerchants || [];
}

// Get business categories
export async function getBusinessCategories(): Promise<FluzBusinessCategory[]> {
  logger.info('Card provider: getBusinessCategories');

  const query = `query {
  getBusinessCategories {
    categoryId
    name
    subCategories {
      categoryId
      name
    }
  }
}`;

  const data = await authenticatedRequest<{ getBusinessCategories: FluzBusinessCategory[] }>(
    query,
    undefined,
    'getBusinessCategories'
  );
  return data.getBusinessCategories || [];
}

// Lookup business by name
export async function lookupBusiness(companyName: string): Promise<FluzMerchant[]> {
  logger.info('Card provider: lookupBusiness', { companyName });

  const query = `query lookupBusiness($input: LookupBusinessInput!) {
  lookupBusiness(input: $input) {
    merchantId
    name
    description
    category
    logoUrl
    status
  }
}`;

  const data = await authenticatedRequest<{ lookupBusiness: FluzMerchant[] }>(
    query,
    { input: { companyName } },
    'lookupBusiness'
  );
  return data.lookupBusiness || [];
}

// Get offer quote
export async function getOfferQuote(
  merchantId: string,
  amount: number
): Promise<FluzOfferQuote> {
  logger.info('Card provider: getOfferQuote', { merchantId, amount });

  const query = `query getOfferQuote($input: GetOfferQuoteInput!) {
  getOfferQuote(input: $input) {
    offerId
    merchantName
    originalPrice
    discountedPrice
    cashbackAmount
    validUntil
  }
}`;

  const data = await authenticatedRequest<{ getOfferQuote: FluzOfferQuote }>(
    query,
    { input: { merchantId, amount } },
    'getOfferQuote'
  );
  return data.getOfferQuote;
}

// Get user addresses
export async function getUserAddresses(): Promise<FluzAddress[]> {
  logger.info('Card provider: getUserAddresses');

  const query = `query {
  getUserAddresses {
    addressId
    streetAddress
    city
    state
    postalCode
    country
    isDefault
  }
}`;

  const data = await authenticatedRequest<{ getUserAddresses: FluzAddress[] }>(
    query,
    undefined,
    'getUserAddresses'
  );
  return data.getUserAddresses || [];
}

// Add/Update address
export async function saveAddress(address: Omit<FluzAddress, 'addressId'>): Promise<FluzAddress> {
  logger.info('Card provider: saveAddress');

  const query = `mutation saveAddress($input: SaveAddressInput!) {
  saveAddress(input: $input) {
    addressId
    streetAddress
    city
    state
    postalCode
    country
    isDefault
  }
}`;

  const data = await authenticatedRequest<{ saveAddress: FluzAddress }>(
    query,
    { input: address },
    'saveAddress'
  );
  return data.saveAddress;
}

// Get referral info
export async function getReferralInfo(): Promise<FluzReferralInfo> {
  logger.info('Card provider: getReferralInfo');

  const query = `query {
  getReferralInfo {
    referralCode
    referralUrl
    totalReferrals
    totalRewards
  }
}`;

  const data = await authenticatedRequest<{ getReferralInfo: FluzReferralInfo }>(
    query,
    undefined,
    'getReferralInfo'
  );
  return data.getReferralInfo;
}

// Get referral URL for a specific merchant
export async function getReferralUrl(merchantId: string): Promise<string> {
  logger.info('Card provider: getReferralUrl', { merchantId });

  const query = `query getReferralUrl($input: GetReferralUrlInput!) {
  getReferralUrl(input: $input)
}`;

  const data = await authenticatedRequest<{ getReferralUrl: string }>(
    query,
    { input: { merchantId } },
    'getReferralUrl'
  );
  return data.getReferralUrl;
}

// Bulk create virtual cards
export async function bulkCreateVirtualCards(
  cards: CreateVirtualCardInput[],
  idempotencyKey: string
): Promise<FluzVirtualCard[]> {
  logger.info('Card provider: bulkCreateVirtualCards', { count: cards.length });

  const query = `mutation bulkCreateVirtualCards($input: BulkCreateVirtualCardsInput!) {
  bulkCreateVirtualCards(input: $input) {
    virtualCardId
    userId
    cardholderName
    expiryMonth
    expiryYear
    virtualCardLast4
    status
    cardType
    initialAmount
    usedAmount
    createdAt
  }
}`;

  const data = await authenticatedRequest<{ bulkCreateVirtualCards: FluzVirtualCard[] }>(
    query,
    { input: { cards, idempotencyKey } },
    'bulkCreateVirtualCards'
  );
  return data.bulkCreateVirtualCards;
}

// Get virtual card bulk order status
export async function getBulkOrderStatus(orderId: string): Promise<{
  orderId: string;
  status: string;
  totalCards: number;
  completedCards: number;
  failedCards: number;
}> {
  logger.info('Card provider: getBulkOrderStatus', { orderId });

  const query = `query getVirtualCardBulkOrderStatus($input: GetBulkOrderStatusInput!) {
  getVirtualCardBulkOrderStatus(input: $input) {
    orderId
    status
    totalCards
    completedCards
    failedCards
  }
}`;

  const data = await authenticatedRequest<{
    getVirtualCardBulkOrderStatus: {
      orderId: string;
      status: string;
      totalCards: number;
      completedCards: number;
      failedCards: number;
    };
  }>(query, { input: { orderId } }, 'getVirtualCardBulkOrderStatus');
  return data.getVirtualCardBulkOrderStatus;
}

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured()) {
    return { success: false, error: 'Card provider credentials not configured' };
  }

  try {
    await generateAccessToken();
    return { success: true };
  } catch (err: any) {
    logger.error('Card provider connection test failed', {
      message: err?.message,
    });
    if (err?.statusCode === 401 || err?.message?.toLowerCase().includes('unauthorized')) {
      return { success: false, error: 'auth_failed' };
    }
    return { success: false, error: err?.message || 'connection_failed' };
  }
}
