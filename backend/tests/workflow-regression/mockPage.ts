import { ActionRecord, Scenario } from './types';

export class MockPage {
  private currentUrl = 'about:blank';
  private history: string[] = ['about:blank'];
  private historyIndex = 0;
  private pageScrollY = 0;
  private pageInnerHeight = 800;
  private pageScrollHeight = 2400;
  private scenario: Scenario;
  public readonly actions: ActionRecord[] = [];

  constructor(scenario: Scenario = {}) {
    this.scenario = scenario;
  }

  url(): string {
    return this.currentUrl;
  }

  async goto(url: string, options?: Record<string, any>): Promise<void> {
    this.currentUrl = url;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(url);
    this.historyIndex = this.history.length - 1;
    this.actions.push({ type: 'goto', url, options });
  }

  async goBack(): Promise<void> {
    if (this.historyIndex > 0) {
      this.historyIndex -= 1;
      this.currentUrl = this.history[this.historyIndex];
    }

    this.actions.push({ type: 'goBack', url: this.currentUrl });
  }

  async goForward(): Promise<void> {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex += 1;
      this.currentUrl = this.history[this.historyIndex];
    }

    this.actions.push({ type: 'goForward', url: this.currentUrl });
  }

  async waitForSelector(selector: string, options?: Record<string, any>): Promise<void> {
    this.actions.push({ type: 'waitForSelector', selector, options });
  }

  async click(selector: string): Promise<void> {
    const clickIndex = this.actions.filter(action => action.type === 'click').length + 1;
    const targetUrl = this.scenario.clickTargets?.[selector] || `mock://clicked/${clickIndex}`;

    this.actions.push({ type: 'click', selector, targetUrl });
    this.currentUrl = targetUrl;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(targetUrl);
    this.historyIndex = this.history.length - 1;
  }

  async type(selector: string, text: string, options?: Record<string, any>): Promise<void> {
    this.actions.push({ type: 'type', selector, text, options });
  }

  async selectOption(selector: string, value: string): Promise<void> {
    this.actions.push({ type: 'selectOption', selector, value });
  }

  async waitForTimeout(duration: number): Promise<void> {
    this.actions.push({ type: 'waitForTimeout', duration });
  }

  async evaluate<TArg = any, TResult = any>(fn: Function, arg?: TArg): Promise<TResult> {
    const source = fn.toString();

    if (typeof arg === 'number') {
      this.pageScrollY += arg;
      this.actions.push({ type: 'pageScroll', distance: arg, scrollY: this.pageScrollY });
      return undefined as TResult;
    }

    if (source.includes('scrollY') && source.includes('scrollHeight')) {
      return {
        scrollY: this.pageScrollY,
        innerHeight: this.pageInnerHeight,
        scrollHeight: this.pageScrollHeight
      } as TResult;
    }

    if (arg && typeof arg === 'object' && 'sel' in (arg as Record<string, any>)) {
      const payload = arg as Record<string, any>;
      this.actions.push({
        type: 'elementScroll',
        selector: payload.sel,
        mode: payload.scrollMode,
        maxTimes: payload.maxTimes,
        distance: payload.distance,
        waitDelay: payload.waitDelay
      });
      return undefined as TResult;
    }

    if (
      arg &&
      typeof arg === 'object' &&
      Array.isArray((arg as Record<string, any>).configs)
    ) {
      const payload = arg as Record<string, any>;
      const configs = payload.configs as Array<Record<string, any>>;
      const isMultiple = Boolean(payload.isMultiple);
      const rowCount = isMultiple ? this.scenario.multipleRowCount || 3 : 1;
      const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
        const row: Record<string, any> = {};

        configs.forEach((config, configIndex) => {
          const key = config.saveToColumn || `field_${configIndex}`;
          const selectorValues = this.scenario.selectorValues?.[config.selector];
          row[key] = selectorValues?.[rowIndex] || this.defaultExtractValue(config, rowIndex);
        });

        return row;
      });

      this.actions.push({
        type: 'extract',
        selectors: configs.map(config => config.selector),
        multiple: isMultiple,
        rowCount
      });
      return rows as TResult;
    }

    if (typeof arg === 'string' && source.includes("querySelectorAll('a[href]')")) {
      const pattern = arg;
      const linkCount = this.scenario.linkCount || 2;
      const links = Array.from({ length: linkCount }, (_, index) => ({
        index: index + 1,
        href: `https://example.com/item-${index + 1}`,
        text: `Link ${index + 1}`,
        title: `Title ${index + 1}`
      })).filter(link => !pattern || link.href.includes(pattern));

      this.actions.push({ type: 'extractLinks', pattern, count: links.length });
      return links as TResult;
    }

    throw new Error(`Unsupported evaluate call in regression mock: ${source.slice(0, 120)}...`);
  }

  private defaultExtractValue(config: Record<string, any>, rowIndex: number): string {
    const attribute =
      config.attribute === 'data-*' && config.customAttribute
        ? config.customAttribute
        : config.attribute || 'text';
    return `${config.saveToColumn || 'value'}:${attribute}:${rowIndex + 1}`;
  }
}
