import { Order, OrderStatus, LogisticEvent } from '../types';
import { MockAPI } from './api';

export const orderService = {
  getAllOrders: async (): Promise<Order[]> => {
    return MockAPI.getAllOrders();
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus, trackingNumber?: string, carrier?: string) => {
    if (status === 'shipped') {
      return MockAPI.shipOrder(orderId, carrier || 'Manual', trackingNumber || '');
    }

    return MockAPI.updateOrderStatus(orderId, status);
  },

  getLogistics: async (order: Order): Promise<LogisticEvent[]> => {
    return MockAPI.getLogistics(order);
  }
};
