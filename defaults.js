/**
 * m3u8DL Sniffer - 默认配置
 * popup 与 options 共用，避免默认值在多处重复定义而漂移。
 */

// 默认翻译提示词（{text} 为待翻译内容占位符）
const DEFAULT_AI_PROMPT = '作为一名专业的翻译官，请翻译标题为简体中文：保留关键信息，控制标题字数在25字以内，仅输出翻译后的内容，不要输出无关内容\n\n{text}';

// 默认下载参数
const DEFAULT_THREAD_COUNT = 32;
const DEFAULT_RETRY_COUNT = 15;
const DEFAULT_AUTO_SELECT = true;
