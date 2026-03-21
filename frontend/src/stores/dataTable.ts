import { defineStore } from 'pinia';

export interface DataTableColumn {
  key: string;
  type: 'text' | 'number' | 'url' | 'image' | 'date';
}

export interface DataTable {
  id: string;
  name: string;
  columns: DataTableColumn[];
  rows: Record<string, any>[];
  createdAt: number;
  updatedAt: number;
}

interface DataTableState {
  tables: DataTable[];
}

export const useDataTableStore = defineStore('dataTable', {
  state: (): DataTableState => ({
    tables: []
  }),

  getters: {
    getTableById: (state) => (id: string) => {
      return state.tables.find(t => t.id === id);
    },

    getTableByName: (state) => (name: string) => {
      return state.tables.find(t => t.name === name);
    }
  },

  actions: {
    // 初始化 - 从 localStorage 加载
    init() {
      const saved = localStorage.getItem('data_tables');
      if (saved) {
        try {
          this.tables = JSON.parse(saved);
        } catch (error) {
          console.error('加载数据表失败:', error);
          this.tables = [];
        }
      }
    },

    // 保存到 localStorage
    save() {
      localStorage.setItem('data_tables', JSON.stringify(this.tables));
    },

    // 创建数据表
    createTable(name: string, columns: DataTableColumn[]): DataTable {
      const table: DataTable = {
        id: `table_${Date.now()}`,
        name,
        columns,
        rows: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.tables.push(table);
      this.save();
      return table;
    },

    // 删除数据表
    deleteTable(id: string) {
      this.tables = this.tables.filter(t => t.id !== id);
      this.save();
    },

    // 更新数据表
    updateTable(id: string, updates: Partial<DataTable>) {
      const table = this.tables.find(t => t.id === id);
      if (table) {
        Object.assign(table, updates);
        table.updatedAt = Date.now();
        this.save();
      }
    },

    // 添加列
    addColumn(tableId: string, column: DataTableColumn) {
      const table = this.tables.find(t => t.id === tableId);
      if (table) {
        table.columns.push(column);
        table.updatedAt = Date.now();
        this.save();
      }
    },

    // 删除列
    deleteColumn(tableId: string, columnKey: string) {
      const table = this.tables.find(t => t.id === tableId);
      if (table) {
        table.columns = table.columns.filter(c => c.key !== columnKey);
        // 同时删除所有行中的该列数据
        table.rows.forEach(row => {
          delete row[columnKey];
        });
        table.updatedAt = Date.now();
        this.save();
      }
    },

    // 重新排序列
    reorderColumns(tableId: string, fromIndex: number, toIndex: number) {
      const table = this.tables.find(t => t.id === tableId);
      if (table) {
        const columns = [...table.columns];
        const [movedColumn] = columns.splice(fromIndex, 1);
        columns.splice(toIndex, 0, movedColumn);
        table.columns = columns;
        table.updatedAt = Date.now();
        this.save();
      }
    },

    // 插入数据
    insertRow(tableId: string, row: Record<string, any>) {
      const table = this.tables.find(t => t.id === tableId);
      if (table) {
        table.rows.push({
          _id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          _timestamp: Date.now(),
          ...row
        });
        table.updatedAt = Date.now();
        this.save();
      }
    },

    // 批量插入数据
    insertRows(tableId: string, rows: Record<string, any>[]) {
      const table = this.tables.find(t => t.id === tableId);
      if (table) {
        rows.forEach(row => {
          table.rows.push({
            _id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            _timestamp: Date.now(),
            ...row
          });
        });
        table.updatedAt = Date.now();
        this.save();
      }
    },

    // 清空数据表
    clearTable(tableId: string) {
      const table = this.tables.find(t => t.id === tableId);
      if (table) {
        table.rows = [];
        table.updatedAt = Date.now();
        this.save();
      }
    },

    // 删除行
    deleteRow(tableId: string, rowId: string) {
      const table = this.tables.find(t => t.id === tableId);
      if (table) {
        table.rows = table.rows.filter(r => r._id !== rowId);
        table.updatedAt = Date.now();
        this.save();
      }
    },

    // 导出数据为 JSON
    exportTableAsJSON(tableId: string): string {
      const table = this.tables.find(t => t.id === tableId);
      if (table) {
        return JSON.stringify(table.rows, null, 2);
      }
      return '[]';
    },

    // 导出数据为 CSV
    exportTableAsCSV(tableId: string): string {
      const table = this.tables.find(t => t.id === tableId);
      if (!table || table.rows.length === 0) {
        return '';
      }

      // CSV 头部
      const headers = table.columns.map(c => c.key).join(',');
      
      // CSV 数据行
      const rows = table.rows.map(row => {
        return table.columns.map(col => {
          const value = row[col.key] || '';
          // 处理包含逗号或引号的值
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',');
      });

      return [headers, ...rows].join('\n');
    }
  }
});
