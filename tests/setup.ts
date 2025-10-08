// 测试环境设置
// 用于配置测试运行时环境

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-api-key';
process.env.GEMINI_MODEL = 'gemini-2.5-pro';
process.env.GEMINI_LITE_MODEL = 'gemini-2.5-flash-lite';

// Mock 全局对象
global.fetch = jest.fn();

// 清理模拟
afterEach(() => {
  jest.clearAllMocks();
});

