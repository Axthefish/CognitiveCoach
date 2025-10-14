// 智能重试机制 - 处理 AI 调用失败和格式错误

import { generateJson, generateText } from './gemini-config';
import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  temperatureDecay?: number;
  onRetry?: (attempt: number, error: string) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  temperatureDecay: 0.2,
  onRetry: (attempt, error) => {
    logger.warn(`Retry attempt ${attempt} due to: ${error}`);
  }
};

// 错误分类和处理策略
export enum ErrorType {
  EMPTY_RESPONSE = 'EMPTY_RESPONSE',
  PARSE_ERROR = 'PARSE_ERROR',
  SCHEMA_VALIDATION_ERROR = 'SCHEMA_VALIDATION_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN'
}

// 智能错误分析器
export function analyzeErrorContext(
  originalPrompt: string,
  errorDetails?: string,
  attemptNumber?: number
): { severity: 'low' | 'medium' | 'high'; patterns: string[]; recommendations: string[] } {
  const patterns: string[] = [];
  const recommendations: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'medium';

  if (errorDetails) {
    // 分析JSON相关错误
    if (errorDetails.includes('JSON') || errorDetails.includes('parse')) {
      patterns.push('json_formatting');
      recommendations.push('Simplify JSON structure', 'Add explicit format example');
      severity = attemptNumber && attemptNumber > 2 ? 'high' : 'medium';
    }
    
    // 分析Schema验证错误
    if (errorDetails.includes('required') || errorDetails.includes('missing')) {
      patterns.push('missing_fields');
      recommendations.push('Emphasize required fields', 'Provide field descriptions');
      severity = 'high';
    }
    
    // 分析内容长度问题
    if (errorDetails.includes('length') || errorDetails.includes('token')) {
      patterns.push('content_length');
      recommendations.push('Request more concise response', 'Break into smaller parts');
      severity = 'low';
    }
  }

  return { severity, patterns, recommendations };
}

// 获取特定错误的示例格式
export function getExampleFormatForError(errorType: ErrorType, stage?: string): string {
  // 只有 PARSE_ERROR 需要具体的格式示例
  if (errorType !== ErrorType.PARSE_ERROR || !stage) {
    return '{"field": "value"}';
  }
  
  const stageExamples: Record<string, string> = {
    s0: '{"status": "clarification_needed", "ai_question": "Your question here"}',
    s1: '[{"id": "example-id", "title": "Example Title", "summary": "Brief summary"}]',
    s2: '{"mermaidChart": "graph TD\\n  A --> B", "metaphor": "Learning is like..."}',
    s3: '{"actionPlan": [{"id": "step-1", "text": "Action text", "isCompleted": false}], "kpis": ["KPI 1"]}',
    s4: '{"analysis": "Analysis text", "suggestions": ["Suggestion 1"], "encouragement": "Encouragement text"}'
  };
  
  return stageExamples[stage] || '{"field": "value"}';
}

// 提取缺失字段信息
export function extractMissingFields(errorDetails?: string): Array<{field: string; description: string}> {
  if (!errorDetails) return [];
  
  const fieldDescriptions = {
    'status': 'Current processing status (clarification_needed/clarified/recommendations_provided)',
    'ai_question': 'Question to ask the user for clarification',
    'goal': 'Refined learning goal statement',
    'recommendations': 'Array of categorized learning recommendations',
    'mermaidChart': 'Mermaid diagram syntax starting with "graph TD"',
    'metaphor': 'Vivid comparison to explain the learning process',
    'actionPlan': 'Array of executable action steps',
    'kpis': 'Array of measurable key performance indicators',
    'analysis': 'Detailed progress analysis',
    'suggestions': 'Array of actionable improvement recommendations',
    'encouragement': 'Motivational closing message'
  };
  
  const missingFields: Array<{field: string; description: string}> = [];
  
  // 简单的字段提取逻辑
  Object.keys(fieldDescriptions).forEach(field => {
    if (errorDetails.includes(field) && errorDetails.includes('required')) {
      missingFields.push({
        field,
        description: fieldDescriptions[field as keyof typeof fieldDescriptions]
      });
    }
  });
  
  return missingFields;
}

// 根据错误类型调整 prompt
export function adjustPromptBasedOnError(
  originalPrompt: string,
  errorType: ErrorType,
  errorDetails?: string,
  attemptNumber: number = 1,
  stage?: string
): string {
  const missingFields = extractMissingFields(errorDetails);
  
  const adjustments: Record<ErrorType, (prompt: string, attempt: number) => string> = {
    [ErrorType.EMPTY_RESPONSE]: (prompt, attempt) => {
      if (attempt === 1) {
        return `${prompt}\n\nCRITICAL: You must provide a complete response. Do not return empty content.`;
      } else if (attempt === 2) {
        return `${prompt}\n\nIMPORTANT: This is attempt #${attempt}. Please ensure you provide a valid, complete JSON response with all required fields.`;
      } else {
        return `SIMPLIFIED REQUEST: Please provide the minimal required response in JSON format:\n${getExampleFormatForError(ErrorType.PARSE_ERROR, stage)}`;
      }
    },
    
    [ErrorType.PARSE_ERROR]: (prompt, attempt) => {
      if (attempt === 1) {
        return `${prompt}\n\nFORMATTING REQUIREMENTS:
1. Return ONLY valid JSON, no additional text
2. Use double quotes for all strings  
3. Ensure all brackets and braces are properly closed
4. Do not include explanatory text before or after JSON

Example format:
${getExampleFormatForError(ErrorType.PARSE_ERROR, stage)}`;
      } else if (attempt === 2) {
        return `${prompt}\n\nSIMPLIFIED: Return this exact JSON structure with your content:
${getExampleFormatForError(ErrorType.PARSE_ERROR, stage)}

Replace the values but keep the exact structure.`;
      } else {
        return `Please return minimal JSON only:\n${getExampleFormatForError(ErrorType.PARSE_ERROR, stage)}`;
      }
    },
    
    [ErrorType.SCHEMA_VALIDATION_ERROR]: (prompt, attempt) => {
      const fieldInfo = missingFields.map(f => `- ${f.field}: ${f.description}`).join('\n');
      
      if (attempt === 1) {
        return `${prompt}\n\nREQUIRED FIELDS MISSING:
${fieldInfo}

Error details: ${errorDetails || 'Schema validation failed'}

Please include ALL required fields in your response.`;
      } else {
        return `${prompt}\n\nCRITICAL: Must include these fields:
${fieldInfo}

Only return the JSON with these required fields.`;
      }
    },
    
    [ErrorType.TIMEOUT]: (prompt, attempt) => {
      if (attempt === 1) {
        return `${prompt}\n\nTIME CONSTRAINT: Please provide a concise response. Aim for brevity while maintaining quality.`;
      } else {
        return `BRIEF RESPONSE REQUIRED: ${prompt.substring(0, 500)}...\n\nProvide the shortest possible valid response.`;
      }
    },
    
    [ErrorType.RATE_LIMIT]: (prompt) => prompt, // 速率限制不需要调整 prompt
    
    [ErrorType.UNKNOWN]: (prompt, attempt) => {
      if (attempt === 1) {
        return `${prompt}\n\nIMPORTANT: Please read all requirements carefully and follow the specified format exactly.`;
      } else {
        return `${prompt}\n\nATTEMPT ${attempt}: Focus on providing exactly what is requested. Follow the format precisely.`;
      }
    }
  };
  
  return adjustments[errorType](originalPrompt, attemptNumber);
}

// 分析错误类型
export function analyzeError(error: string | Error): ErrorType {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  if (errorMessage.includes('EMPTY_RESPONSE')) {
    return ErrorType.EMPTY_RESPONSE;
  } else if (errorMessage.includes('PARSE_ERROR') || errorMessage.includes('JSON')) {
    return ErrorType.PARSE_ERROR;
  } else if (errorMessage.includes('schema') || errorMessage.includes('validation')) {
    return ErrorType.SCHEMA_VALIDATION_ERROR;
  } else if (errorMessage.includes('timeout')) {
    return ErrorType.TIMEOUT;
  } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return ErrorType.RATE_LIMIT;
  }
  
  return ErrorType.UNKNOWN;
}

// 计算重试延迟
export function calculateDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  const delay = Math.min(
    options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1),
    options.maxDelay
  );
  
  // 添加随机抖动以避免重试风暴
  const jitter = delay * 0.1 * Math.random();
  return Math.floor(delay + jitter);
}

// 带重试的 JSON 生成
export async function generateJsonWithRetry<T>(
  prompt: string,
  validator: (data: unknown) => data is T,
  options?: RetryOptions,
  runTier?: 'Pro' | 'Review',
  stage?: string
): Promise<{ ok: true; data: T; attempts: number } | { ok: false; error: string; attempts: number; errorContext?: ReturnType<typeof analyzeErrorContext> }> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let currentPrompt = prompt;
  let lastError: string = '';
  let errorContext: ReturnType<typeof analyzeErrorContext> | undefined;
  
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      // 逐步降低 temperature
      const temperature = Math.max(0.3, 0.8 - (attempt - 1) * opts.temperatureDecay);
      
      const result = await generateJson<unknown>(
        currentPrompt,
        { temperature, maxOutputTokens: 65536 },
        runTier
      );
      
      if (result.ok && validator(result.data)) {
        return { ok: true, data: result.data as T, attempts: attempt };
      }
      
      // 分析错误并调整 prompt
      lastError = result.ok ? 'Validation failed' : result.error;
      const errorType = analyzeError(lastError);
      errorContext = analyzeErrorContext(currentPrompt, lastError, attempt);
      
      if (errorType === ErrorType.RATE_LIMIT) {
        // 速率限制需要更长的等待时间
        await new Promise(resolve => setTimeout(resolve, 60000));
      } else {
        currentPrompt = adjustPromptBasedOnError(currentPrompt, errorType, lastError, attempt, stage);
        opts.onRetry(attempt, lastError);
        
        if (attempt < opts.maxRetries) {
          const delay = calculateDelay(attempt, opts);
          // 根据错误严重程度调整延迟
          const severityMultiplier = errorContext.severity === 'high' ? 2 : errorContext.severity === 'low' ? 0.5 : 1;
          const adjustedDelay = Math.floor(delay * severityMultiplier);
          await new Promise(resolve => setTimeout(resolve, adjustedDelay));
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      const errorType = analyzeError(lastError);
      errorContext = analyzeErrorContext(currentPrompt, lastError, attempt);
      currentPrompt = adjustPromptBasedOnError(currentPrompt, errorType, lastError, attempt, stage);
      opts.onRetry(attempt, lastError);
      
      if (attempt < opts.maxRetries) {
        const delay = calculateDelay(attempt, opts);
        const severityMultiplier = errorContext.severity === 'high' ? 2 : errorContext.severity === 'low' ? 0.5 : 1;
        const adjustedDelay = Math.floor(delay * severityMultiplier);
        await new Promise(resolve => setTimeout(resolve, adjustedDelay));
      }
    }
  }
  
  return { ok: false, error: lastError, attempts: opts.maxRetries, errorContext };
}

// 带重试的文本生成
export async function generateTextWithRetry(
  prompt: string,
  options?: RetryOptions,
  runTier?: 'Pro' | 'Review'
): Promise<{ ok: true; text: string } | { ok: false; error: string; attempts: number }> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let currentPrompt = prompt;
  let lastError: string = '';
  
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      const temperature = Math.max(0.3, 0.8 - (attempt - 1) * opts.temperatureDecay);
      
      const result = await generateText(
        currentPrompt,
        { temperature, maxOutputTokens: 65536 },
        runTier
      );
      
      if (result.ok && result.text.trim().length > 0) {
        return { ok: true, text: result.text };
      }
      
      lastError = result.ok ? 'Empty response' : result.error;
      const errorType = analyzeError(lastError);
      currentPrompt = adjustPromptBasedOnError(currentPrompt, errorType);
      opts.onRetry(attempt, lastError);
      
      if (attempt < opts.maxRetries) {
        const delay = calculateDelay(attempt, opts);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      opts.onRetry(attempt, lastError);
      
      if (attempt < opts.maxRetries) {
        const delay = calculateDelay(attempt, opts);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return { ok: false, error: lastError, attempts: opts.maxRetries };
}

// 批量处理多个 prompt 并选择最佳结果
export async function generateBestOf<T>(
  prompts: string[],
  validator: (data: unknown) => data is T,
  scorer: (data: T) => number,
  runTier?: 'Pro' | 'Review'
): Promise<{ ok: true; data: T; score: number } | { ok: false; error: string }> {
  const results = await Promise.allSettled(
    prompts.map(prompt => 
      generateJsonWithRetry(prompt, validator, { maxRetries: 2 }, runTier)
    )
  );
  
  const validResults: Array<{ data: T; score: number }> = [];
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.ok) {
      const score = scorer(result.value.data);
      validResults.push({ data: result.value.data, score });
    }
  }
  
  if (validResults.length === 0) {
    return { ok: false, error: 'All attempts failed to generate valid results' };
  }
  
  // 选择得分最高的结果
  validResults.sort((a, b) => b.score - a.score);
  const best = validResults[0];
  
  return { ok: true, data: best.data, score: best.score };
}
