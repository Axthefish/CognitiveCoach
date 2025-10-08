// 用户友好的错误消息映射
// 提供清晰、可操作的错误提示

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestion?: string;
  actionable: boolean;
}

// Schema 验证错误的详细映射
export const SCHEMA_ERROR_MAP: Record<string, UserFriendlyError> = {
  'userGoal': {
    title: '学习目标缺失',
    message: '请输入您的学习目标',
    suggestion: '例如：学习 TypeScript 高级特性、掌握机器学习基础',
    actionable: true
  },
  'userInput': {
    title: '输入内容缺失',
    message: '请输入您的问题或目标',
    actionable: true
  },
  'framework': {
    title: '知识框架数据缺失',
    message: '无法生成系统动力图，请先完成知识框架阶段',
    actionable: true
  },
  'actionPlan': {
    title: '行动计划数据缺失',
    message: '无法分析进度，请先完成行动计划阶段',
    actionable: true
  },
  'progressData': {
    title: '进度数据缺失',
    message: '请提供您的学习进度信息',
    suggestion: '包括：已完成任务、遇到的挑战、花费时间等',
    actionable: true
  },
  'question': {
    title: '问题内容缺失',
    message: '请输入您想咨询的问题',
    actionable: true
  }
};

// API 错误类型映射
export const API_ERROR_MAP: Record<string, UserFriendlyError> = {
  'NO_API_KEY': {
    title: 'API 密钥未配置',
    message: '系统未配置 AI API 密钥，无法提供智能服务',
    suggestion: '请联系管理员配置 GEMINI_API_KEY 或 GOOGLE_AI_API_KEY',
    actionable: false
  },
  'TIMEOUT': {
    title: '请求超时',
    message: 'AI 响应时间过长，请求已超时',
    suggestion: '可能是网络不稳定或请求过于复杂。建议：1) 检查网络连接 2) 简化问题 3) 稍后重试',
    actionable: true
  },
  'RATE_LIMIT': {
    title: '请求过于频繁',
    message: '您的请求过于频繁，已触发速率限制',
    suggestion: '请稍等片刻后再试',
    actionable: true
  },
  'PARSE_ERROR': {
    title: 'AI 响应格式错误',
    message: 'AI 返回的数据格式不正确，系统无法解析',
    suggestion: '这可能是临时问题，请重试。如果持续出现，请联系技术支持',
    actionable: true
  },
  'SCHEMA_VALIDATION_ERROR': {
    title: '数据验证失败',
    message: 'AI 返回的数据不完整或格式不符合要求',
    suggestion: '系统正在自动重试。如果问题持续，请简化您的需求后重试',
    actionable: true
  },
  'EMPTY_RESPONSE': {
    title: 'AI 响应为空',
    message: 'AI 未返回任何内容',
    suggestion: '请重试。如果问题持续，请尝试重新表述您的问题',
    actionable: true
  },
  'API_ERROR': {
    title: 'AI 服务异常',
    message: 'AI 服务暂时不可用',
    suggestion: '可能的原因：1) API 配额已用完 2) 服务暂时中断。请稍后重试',
    actionable: true
  },
  'NETWORK_ERROR': {
    title: '网络连接失败',
    message: '无法连接到 AI 服务',
    suggestion: '请检查您的网络连接，然后重试',
    actionable: true
  }
};

// 阶段特定错误
export const STAGE_ERROR_MAP: Record<string, Record<string, UserFriendlyError>> = {
  S1: {
    'QA_FAILED': {
      title: '知识框架质量检查未通过',
      message: '生成的知识框架存在结构问题',
      suggestion: '系统正在自动优化。您也可以尝试：1) 更明确地描述学习目标 2) 缩小主题范围',
      actionable: true
    },
    'INVALID_FORMAT': {
      title: '知识框架格式错误',
      message: '生成的知识框架结构不完整',
      actionable: true
    }
  },
  S2: {
    'MERMAID_INVALID': {
      title: '系统图表生成失败',
      message: '生成的 Mermaid 图表语法不正确',
      suggestion: '系统正在重新生成。您可以稍后手动调整',
      actionable: true
    },
    'COVERAGE_LOW': {
      title: '知识覆盖不完整',
      message: '系统动力图未覆盖所有知识节点',
      suggestion: '部分知识点可能被遗漏。建议重新生成或手动补充',
      actionable: true
    }
  },
  S3: {
    'MISSING_METRICS': {
      title: '缺少关键指标',
      message: '行动计划缺少可衡量的关键指标(KPI)',
      suggestion: '请确保计划包含：触发条件、诊断步骤、应对选项',
      actionable: true
    },
    'ACTIONABILITY_LOW': {
      title: '行动计划不够具体',
      message: '部分行动项缺少明确的执行步骤或评估标准',
      suggestion: '建议细化每个步骤，添加具体的时间点和可衡量的目标',
      actionable: true
    }
  },
  S4: {
    'NO_CONTEXT': {
      title: '缺少学习上下文',
      message: '无法分析进度，缺少必要的学习历史数据',
      suggestion: '请先完成前面的学习阶段',
      actionable: true
    }
  }
};

/**
 * 根据错误代码获取用户友好的错误信息
 */
export function getUserFriendlyError(
  errorCode: string,
  stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4',
  details?: string
): UserFriendlyError {
  // 优先查找阶段特定错误
  if (stage && STAGE_ERROR_MAP[stage]?.[errorCode]) {
    return STAGE_ERROR_MAP[stage][errorCode];
  }
  
  // 查找 API 错误
  if (API_ERROR_MAP[errorCode]) {
    return API_ERROR_MAP[errorCode];
  }
  
  // 查找 Schema 错误
  if (SCHEMA_ERROR_MAP[errorCode]) {
    return SCHEMA_ERROR_MAP[errorCode];
  }
  
  // 默认错误
  return {
    title: '操作失败',
    message: details || '发生未知错误，请重试',
    suggestion: '如果问题持续出现，请联系技术支持并提供错误详情',
    actionable: true
  };
}

/**
 * 从 Zod 错误中提取用户友好的消息
 */
export function extractZodErrorMessage(zodError: { issues: Array<{ path: (string | number)[]; message: string }> }): UserFriendlyError {
  if (!zodError.issues || zodError.issues.length === 0) {
    return getUserFriendlyError('UNKNOWN');
  }
  
  const firstIssue = zodError.issues[0];
  const fieldPath = firstIssue.path.join('.');
  const fieldName = firstIssue.path[firstIssue.path.length - 1] as string;
  
  // 查找该字段的友好错误
  if (SCHEMA_ERROR_MAP[fieldName]) {
    return SCHEMA_ERROR_MAP[fieldName];
  }
  
  // 生成通用错误消息
  return {
    title: '请求格式不正确',
    message: `字段 "${fieldPath}" ${firstIssue.message}`,
    suggestion: `请检查输入数据。共有 ${zodError.issues.length} 个验证错误`,
    actionable: true
  };
}

/**
 * 格式化错误响应
 */
export function formatErrorResponse(error: UserFriendlyError, includeDetails = false) {
  const response: {
    status: 'error';
    error: string;
    title: string;
    suggestion?: string;
    actionable: boolean;
    details?: string;
  } = {
    status: 'error',
    error: error.message,
    title: error.title,
    actionable: error.actionable
  };
  
  if (error.suggestion) {
    response.suggestion = error.suggestion;
  }
  
  return response;
}

