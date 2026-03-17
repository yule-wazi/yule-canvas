import type { Script } from '../stores/script';

export interface ScrapedData {
  id: string;
  scriptId: string;
  data: any;
  status: 'success' | 'failed';
  executedAt: number;
  duration: number;
  logs: string[];
}

class StorageManager {
  private SCRIPTS_KEY = 'scraping_scripts';
  private DATA_KEY = 'scraped_data';

  // 脚本CRUD
  saveScript(script: Script): void {
    const scripts = this.getAllScripts();
    const index = scripts.findIndex(s => s.id === script.id);
    
    if (index >= 0) {
      scripts[index] = script;
    } else {
      scripts.push(script);
    }
    
    localStorage.setItem(this.SCRIPTS_KEY, JSON.stringify(scripts));
  }

  getScript(id: string): Script | null {
    const scripts = this.getAllScripts();
    return scripts.find(s => s.id === id) || null;
  }

  getAllScripts(): Script[] {
    const data = localStorage.getItem(this.SCRIPTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  updateScript(id: string, updates: Partial<Script>): void {
    const script = this.getScript(id);
    if (script) {
      const updated = { ...script, ...updates, updatedAt: Date.now() };
      this.saveScript(updated);
    }
  }

  deleteScript(id: string): void {
    const scripts = this.getAllScripts().filter(s => s.id !== id);
    localStorage.setItem(this.SCRIPTS_KEY, JSON.stringify(scripts));
  }

  // 数据CRUD
  saveData(data: ScrapedData): void {
    const allData = this.getAllData();
    allData.push(data);
    localStorage.setItem(this.DATA_KEY, JSON.stringify(allData));
  }

  getData(id: string): ScrapedData | null {
    const allData = this.getAllData();
    return allData.find(d => d.id === id) || null;
  }

  getAllData(): ScrapedData[] {
    const data = localStorage.getItem(this.DATA_KEY);
    return data ? JSON.parse(data) : [];
  }

  getDataByScriptId(scriptId: string): ScrapedData[] {
    return this.getAllData().filter(d => d.scriptId === scriptId);
  }

  deleteData(id: string): void {
    const allData = this.getAllData().filter(d => d.id !== id);
    localStorage.setItem(this.DATA_KEY, JSON.stringify(allData));
  }

  // 容量管理
  getStorageUsage(): { used: number; total: number; percentage: number } {
    let used = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }
    
    const total = 5 * 1024 * 1024; // 5MB估算
    return {
      used,
      total,
      percentage: (used / total) * 100
    };
  }

  clearOldData(daysOld: number): void {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const allData = this.getAllData().filter(d => d.executedAt > cutoff);
    localStorage.setItem(this.DATA_KEY, JSON.stringify(allData));
  }
}

export default new StorageManager();
