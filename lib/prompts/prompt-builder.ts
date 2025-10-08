// 通用 Prompt Builder 工具类

/**
 * Prompt 构建器基类
 * 提供通用的 prompt 构建功能
 */
export class PromptBuilder {
  private template: string;
  private variables: Record<string, string> = {};

  constructor(template: string) {
    this.template = template;
  }

  /**
   * 设置变量
   */
  setVariable(key: string, value: string): this {
    this.variables[key] = value;
    return this;
  }

  /**
   * 批量设置变量
   */
  setVariables(vars: Record<string, string>): this {
    this.variables = { ...this.variables, ...vars };
    return this;
  }

  /**
   * 构建最终的 prompt
   */
  build(): string {
    let result = this.template;
    
    // 替换所有变量
    for (const [key, value] of Object.entries(this.variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
    
    return result;
  }

  /**
   * 重置构建器
   */
  reset(): this {
    this.variables = {};
    return this;
  }
}

/**
 * Prompt 版本管理
 */
export class PromptVersionManager {
  private versions: Map<string, Map<string, string>> = new Map();
  private currentVersions: Map<string, string> = new Map();

  /**
   * 注册一个 prompt 版本
   */
  registerVersion(
    promptId: string,
    version: string,
    content: string
  ): void {
    if (!this.versions.has(promptId)) {
      this.versions.set(promptId, new Map());
    }
    this.versions.get(promptId)!.set(version, content);
    
    // 如果是第一个版本，设置为当前版本
    if (!this.currentVersions.has(promptId)) {
      this.currentVersions.set(promptId, version);
    }
  }

  /**
   * 设置当前使用的版本
   */
  setCurrentVersion(promptId: string, version: string): void {
    const versions = this.versions.get(promptId);
    if (!versions || !versions.has(version)) {
      throw new Error(
        `Version ${version} not found for prompt ${promptId}`
      );
    }
    this.currentVersions.set(promptId, version);
  }

  /**
   * 获取指定版本的 prompt
   */
  getPrompt(promptId: string, version?: string): string {
    const versions = this.versions.get(promptId);
    if (!versions) {
      throw new Error(`Prompt ${promptId} not found`);
    }

    const targetVersion = version || this.currentVersions.get(promptId);
    if (!targetVersion) {
      throw new Error(`No version specified for prompt ${promptId}`);
    }

    const content = versions.get(targetVersion);
    if (!content) {
      throw new Error(
        `Version ${targetVersion} not found for prompt ${promptId}`
      );
    }

    return content;
  }

  /**
   * 获取所有可用版本
   */
  getAvailableVersions(promptId: string): string[] {
    const versions = this.versions.get(promptId);
    return versions ? Array.from(versions.keys()) : [];
  }
}

/**
 * 全局 prompt 版本管理器实例
 */
export const promptVersionManager = new PromptVersionManager();

/**
 * Prompt 模板工具函数
 */
export const PromptUtils = {
  /**
   * 截断文本到指定长度
   */
  truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  },

  /**
   * 转义特殊字符
   */
  escape(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  },

  /**
   * 格式化列表
   */
  formatList(items: string[], numbered: boolean = false): string {
    return items
      .map((item, index) => 
        numbered ? `${index + 1}. ${item}` : `- ${item}`
      )
      .join('\n');
  },

  /**
   * 构建上下文摘要
   */
  buildContextSummary(context: Record<string, unknown>): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(context)) {
      if (value !== null && value !== undefined) {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
    return lines.join('\n');
  },
} as const;

