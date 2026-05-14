/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
}

export type OrderStatus = 'Pendiente' | 'Enviado' | 'Entregado' | 'Cancelado';

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  timestamp: string;
  status: OrderStatus;
  trackingNumber: string;
}

export interface AppConfig {
  excelSheetName: string;
  excelFileName: string;
}
