import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CardXC API',
      version: '2.0.0',
      description: 'CardXC Fintech Platform API - Virtual cards, payments, savings, and rewards',
      contact: {
        name: 'CardXC Support',
        email: 'support@cardxc.com',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['deposit', 'withdrawal', 'transfer', 'payment'] },
            amount_cents: { type: 'integer' },
            currency: { type: 'string', example: 'USD' },
            status: { type: 'string', enum: ['pending', 'success', 'failed'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        PaymentLink: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            code: { type: 'string' },
            amount_cents: { type: 'integer', nullable: true },
            currency: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['active', 'used', 'expired'] },
            expires_at: { type: 'string', format: 'date-time' },
          },
        },
        SavingsVault: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            balance_cents: { type: 'integer' },
            goal_cents: { type: 'integer', nullable: true },
            currency: { type: 'string' },
          },
        },
        Budget: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            category: { type: 'string' },
            limit_cents: { type: 'integer' },
            spent_cents: { type: 'integer' },
            period: { type: 'string', enum: ['weekly', 'monthly', 'yearly'] },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  },
  apis: ['./server/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
