// 导入 V2 架构的客户端页面
import ClientPageV2 from './client-page-v2';

/**
 * CognitiveCoach V2 主页面
 * 
 * 新架构：通用框架 + 个性化补充
 * - Stage 0: 目的澄清（对话式）
 * - Stage 1: 通用框架生成（逻辑流程图+权重）
 * - Stage 2: 个性化方案（动态信息收集+实时更新）
 */
export default function Home() {
  return <ClientPageV2 />;
}