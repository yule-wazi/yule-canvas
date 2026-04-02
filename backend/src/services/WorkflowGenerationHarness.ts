import { RecordingSemanticPackage } from './RecordingSemanticBuilder';

export interface WorkflowGenerationHarness {
  version: 'workflow-harness.v1';
  observedUrls: string[];
  clickedSelectors: string[];
  clickedHrefTargets: string[];
  markedFields: Array<{
    name: string;
    type: string;
    selector: string;
    pageUrl: string;
  }>;
  allowedBlockTypes: string[];
  forbiddenBlockTypes: string[];
  behavioralRules: string[];
}

function normalizeText(value: string): string {
  return String(value || '').trim();
}

function resolveHref(baseUrl: string, href: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

export class WorkflowGenerationHarnessBuilder {
  static build(recording: RecordingSemanticPackage): WorkflowGenerationHarness {
    const observedUrls = new Set<string>();
    const clickedSelectors = new Set<string>();
    const clickedHrefTargets = new Set<string>();
    const markedFields: WorkflowGenerationHarness['markedFields'] = [];
    const actionCounts = recording.summary?.actionCounts || {};

    (recording.semanticSteps || []).forEach((event: any) => {
      const pageUrl = normalizeText(event?.page?.url || event?.url || '');
      if (pageUrl) {
        observedUrls.add(pageUrl);
      }

      if (event?.action === 'click' && normalizeText(event?.target?.selector)) {
        clickedSelectors.add(normalizeText(event.target.selector));
      }

      if (event?.action === 'click' && normalizeText(event?.target?.href)) {
        clickedHrefTargets.add(resolveHref(pageUrl, normalizeText(event.target.href)));
      }

      if (event?.kind === 'mark' && normalizeText(event?.field?.name) && normalizeText(event?.target?.selector)) {
        markedFields.push({
          name: normalizeText(event.field.name),
          type: normalizeText(event.field.type || 'text'),
          selector: normalizeText(event.target.selector),
          pageUrl
        });
      }
    });

    const allowedBlockTypes = ['navigate', 'click', 'extract', 'wait', 'scroll', 'log'];
    const forbiddenBlockTypes = new Set<string>(['transform', 'filter', 'condition']);
    const behavioralRules: string[] = [
      '所有 URL 必须来自 observedUrls 或由点击事件中的 href 直接解析得到。',
      '所有 click.selector 必须来自 clickedSelectors。',
      '所有 extract 的 selector 和字段名必须来自 markedFields。',
      '禁止生成占位 URL、示例域名、虚构 selector、虚构字段名。'
    ];

    const hasBackLikeEvidence = Number(actionCounts.back || 0) > 0 || Number(actionCounts.forward || 0) > 0;
    const hasMultiPageEvidence = Array.isArray(recording.pages) && recording.pages.length > 1;
    const hasNewTabEvidence = (recording.semanticSteps || []).some((event: any) => event?.opener || event?.action === 'contextmenu' || event?.action === 'middle-click');
    const hasExtractLinksEvidence = Number(actionCounts['extract-links'] || 0) > 0;

    if (hasBackLikeEvidence) {
      allowedBlockTypes.push('back', 'forward');
      forbiddenBlockTypes.delete('condition');
      behavioralRules.push('仅当录制中出现 back/forward 证据时，才允许生成 back/forward。');
    } else {
      forbiddenBlockTypes.add('back');
      forbiddenBlockTypes.add('forward');
      behavioralRules.push('录制中没有 back/forward 证据，禁止生成 back/forward。');
    }

    if (hasMultiPageEvidence || hasNewTabEvidence || hasExtractLinksEvidence) {
      allowedBlockTypes.push('extract-links');
      behavioralRules.push('只有在存在多页链路或明确链接提取证据时，才允许生成 extract-links。');
    } else {
      forbiddenBlockTypes.add('extract-links');
      behavioralRules.push('当前录制只覆盖单次点击进入详情页，禁止生成 extract-links。');
    }

    if (hasBackLikeEvidence && hasMultiPageEvidence && (recording.semanticSteps || []).length >= 6) {
      allowedBlockTypes.push('loop');
      behavioralRules.push('只有录制存在明显重复/回退链路时，才允许生成 loop。');
    } else {
      forbiddenBlockTypes.add('loop');
      behavioralRules.push('当前录制没有足够证据支持循环批量采集，禁止生成 loop。');
    }

    return {
      version: 'workflow-harness.v1',
      observedUrls: Array.from(observedUrls),
      clickedSelectors: Array.from(clickedSelectors),
      clickedHrefTargets: Array.from(clickedHrefTargets),
      markedFields,
      allowedBlockTypes: Array.from(new Set(allowedBlockTypes)),
      forbiddenBlockTypes: Array.from(forbiddenBlockTypes),
      behavioralRules
    };
  }
}
