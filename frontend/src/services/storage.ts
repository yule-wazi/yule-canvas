export interface ScrapedData {
  id: string;
  workflowId: string;
  data: any;
  status: 'success' | 'failed';
  executedAt: number;
  duration: number;
  logs: string[];
}

class StorageManager {
  private DATA_KEY = 'scraped_data';

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

  getDataByWorkflowId(workflowId: string): ScrapedData[] {
    return this.getAllData().filter(d => d.workflowId === workflowId);
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
