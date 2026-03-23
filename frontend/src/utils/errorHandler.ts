export class ErrorHandler {
  static handle(error: any, context: string = '操作') {
    console.error(`[${context}]`, error);
    
    const message = this.getUserMessage(error);
    this.showNotification(message, 'error');
    
    return message;
  }

  private static getUserMessage(error: any): string {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    
    if (error.message) {
      if (error.message.includes('timeout')) {
        return '操作超时，请检查网络连接';
      }
      if (error.message.includes('network')) {
        return '网络错误，请检查连接';
      }
      if (error.message.includes('API')) {
        return 'API调用失败，请检查配置';
      }
      return error.message;
    }
    
    return '操作失败，请重试';
  }

  private static showNotification(message: string, type: 'success' | 'error' | 'warning') {
    // 使用 console 输出，实际项目中应该使用 Toast 组件
    console.warn(`[${type.toUpperCase()}]`, message);
  }

  static async wrapAsync<T>(
    fn: () => Promise<T>,
    context: string = '操作'
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, context);
      return null;
    }
  }
}

export default ErrorHandler;
