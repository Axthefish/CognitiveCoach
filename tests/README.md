# 测试框架

本目录包含 CognitiveCoach 项目的所有测试。

## 目录结构

```
tests/
├── setup.ts                 # 测试环境设置
├── unit/                    # 单元测试
│   ├── lib/                 # 工具库测试
│   │   ├── cache-service.test.ts
│   │   └── prompts/
│   │       └── s1-prompts.test.ts
│   └── services/            # 服务层测试
│       └── s1-service.test.ts
├── integration/             # 集成测试（待添加）
│   └── api/
└── e2e/                     # 端到端测试（待添加）
```

## 运行测试

### 运行所有测试
```bash
npm test
```

### 运行特定测试文件
```bash
npm test -- cache-service.test.ts
```

### 运行测试并生成覆盖率报告
```bash
npm test -- --coverage
```

### 监视模式（开发时使用）
```bash
npm test -- --watch
```

## 测试指南

### 单元测试

单元测试应该：
- 测试单个函数或类的行为
- 使用 mock 隔离外部依赖
- 运行速度快
- 不依赖外部资源（数据库、API等）

示例：
```typescript
import { CacheService } from '@/lib/cache-service';

describe('CacheService', () => {
  it('should store and retrieve values', () => {
    const cache = new CacheService('test');
    cache.set('key', { value: 'test' });
    
    const result = cache.get('key');
    expect(result).toEqual({ value: 'test' });
  });
});
```

### 集成测试

集成测试应该：
- 测试多个模块的交互
- 使用真实的依赖（或轻量级 mock）
- 验证端到端的功能

### E2E 测试

端到端测试应该：
- 测试完整的用户流程
- 使用真实的浏览器
- 覆盖关键用户场景

## 最佳实践

1. **遵循 AAA 模式**
   - Arrange: 设置测试环境
   - Act: 执行被测试的操作
   - Assert: 验证结果

2. **使用描述性的测试名称**
   ```typescript
   it('should return 400 when user goal is empty', () => {
     // test code
   });
   ```

3. **每个测试只测试一件事**
   - 保持测试简单和专注
   - 方便定位问题

4. **使用 beforeEach/afterEach 清理**
   ```typescript
   beforeEach(() => {
     // 设置测试环境
   });
   
   afterEach(() => {
     // 清理
     jest.clearAllMocks();
   });
   ```

5. **Mock 外部依赖**
   ```typescript
   jest.mock('@/lib/gemini-config');
   ```

## 待完成的测试

- [ ] S0 Service 测试
- [ ] S2 Service 测试
- [ ] S3 Service 测试
- [ ] S4 Service 测试
- [ ] API 路由集成测试
- [ ] QA 系统测试
- [ ] 错误处理测试
- [ ] E2E 测试

