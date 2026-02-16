import { Router } from 'express';
import * as systemController from '../controllers/system.controller';
import * as authController from '../controllers/auth.controller';
import * as userController from '../controllers/user.controller';
import * as productController from '../controllers/product.controller';
import * as orderController from '../controllers/order.controller';
import * as complaintController from '../controllers/complaint.controller';
import * as paymentController from '../controllers/payment.controller';
import * as adminController from '../controllers/admin.controller';
import * as analyticsController from '../controllers/analytics.controller';
import * as cartController from '../controllers/cart.controller';
import * as uploadController from '../controllers/upload.controller';
import * as notificationController from '../controllers/notification.controller';
import * as communityController from '../controllers/community.controller';
import * as aiAdminController from '../controllers/ai-admin.controller';
import { optionalAuth, requireAuth, requireRole } from '../middlewares/auth.middleware';
import { requireCommunitySession } from '../middlewares/community-session.middleware';
import {
  loginRateLimit,
  orderRateLimit,
  paymentCreateRateLimit,
  paymentMockConfirmRateLimit,
  paymentNotifyRateLimit,
  communityAnalysisRateLimit
} from '../middlewares/rate-limit.middleware';
import { success } from '../utils/response';

const router = Router();

router.get('/health', (_req, res) => success(res, { ok: true }));

// --- Public System ---
router.get('/system/config', systemController.getSystemConfig);
router.get('/system/banners', systemController.getBanners);

// --- Auth ---
router.post('/auth/login', loginRateLimit, authController.adminLogin);
router.post('/auth/wechat', loginRateLimit, authController.wechatLogin);
router.get('/auth/me', requireAuth, authController.me);

// Compatibility aliases
router.get('/user/me', requireAuth, userController.getMe);
router.post('/user/me', requireAuth, userController.updateMe);

// --- Products Public ---
router.get('/products/inventory-tree', productController.getInventoryTree);
router.get('/products/addons', productController.getAddOns);
router.get('/products/plaza', productController.getPlazaDesigns);

// --- Coupons Public ---
router.get('/coupons/templates', userController.getCouponTemplates);

// --- Analytics ---
router.post('/analytics/events', optionalAuth, analyticsController.captureEvent);
router.post('/uploads/image', requireAuth, uploadController.uploadImage);
router.get('/uploads/token', requireAuth, uploadController.getUploadToken);

// --- Payment callback ---
router.post('/payments/notify', paymentNotifyRateLimit, paymentController.notifyPayment);

// --- User Protected ---
router.get('/user/designs', requireAuth, userController.getDesigns);
router.post('/user/designs', requireAuth, userController.saveDesign);
router.delete('/user/designs/:id', requireAuth, userController.deleteDesign);

router.get('/user/addresses', requireAuth, userController.getAddresses);
router.post('/user/addresses', requireAuth, userController.addAddress);
router.put('/user/addresses/:id', requireAuth, userController.editAddress);
router.delete('/user/addresses/:id', requireAuth, userController.removeAddress);
router.post('/user/addresses/:id/default', requireAuth, userController.makeDefaultAddress);

router.get('/user/points/history', requireAuth, userController.getPointsHistory);
router.get('/user/cart', requireAuth, cartController.getCart);
router.put('/user/cart', requireAuth, cartController.putCart);
router.post('/user/cart/items', requireAuth, cartController.createCartItem);
router.patch('/user/cart/items/:id', requireAuth, cartController.patchCartItem);
router.delete('/user/cart/items/:id', requireAuth, cartController.removeCartItem);

router.get('/user/coupons', requireAuth, userController.getMyCoupons);
router.post('/user/coupons/claim/:templateId', requireAuth, userController.claimUserCoupon);

router.get('/user/withdrawals', requireAuth, userController.getMyWithdrawals);
router.post('/user/withdrawals', requireAuth, userController.applyWithdrawal);
router.get('/user/notifications', requireAuth, notificationController.getMyNotifications);
router.post('/user/notifications/read-all', requireAuth, notificationController.readAllNotifications);
router.post('/user/notifications/:id/read', requireAuth, notificationController.readNotification);

// --- Plaza protected ---
router.post('/products/plaza', requireAuth, productController.publishDesign);
router.post('/products/plaza/:id/like', requireAuth, productController.likePlazaDesign);

// --- Community ---
router.post('/community/analysis/bazi', requireAuth, requireCommunitySession, communityAnalysisRateLimit, communityController.analyzeBazi);
router.post('/community/analysis/liuyao', requireAuth, requireCommunitySession, communityAnalysisRateLimit, communityController.analyzeLiuyao);

router.post('/community/drafts', requireAuth, requireCommunitySession, communityController.saveDraft);
router.get('/community/drafts/latest', requireAuth, requireCommunitySession, communityController.getLatestDraft);

router.post('/community/reports', requireAuth, requireCommunitySession, communityController.saveReport);
router.get('/community/reports', requireAuth, requireCommunitySession, communityController.listReports);
router.get('/community/reports/:id', requireAuth, requireCommunitySession, communityController.getReportById);
router.delete('/community/reports/:id', requireAuth, requireCommunitySession, communityController.deleteReportById);

router.get('/community/recommend/beads', requireAuth, requireCommunitySession, communityController.recommendBeads);
router.post('/community/events', requireAuth, requireCommunitySession, communityController.captureEvent);

// --- Orders ---
router.get('/orders', requireAuth, orderController.getMyOrders);
router.get('/orders/:id', requireAuth, orderController.getOrderByIdHandler);
router.post('/orders', requireAuth, orderRateLimit, orderController.createOrderHandler);
router.post('/orders/:id/pay', requireAuth, orderController.payOrder);
router.post('/orders/:id/confirm', requireAuth, orderController.confirmOrder);
router.post('/orders/:id/cancel', requireAuth, orderController.cancelOrder);
router.get('/orders/:id/logistics', requireAuth, orderController.getLogisticsHandler);

// --- Payment ---
router.post('/payments/create', requireAuth, paymentCreateRateLimit, paymentController.createPayment);
router.post('/payments/mock-confirm', requireAuth, paymentMockConfirmRateLimit, paymentController.mockConfirmPayment);

// --- Complaints ---
router.get('/complaints', requireAuth, complaintController.getMyComplaints);
router.post('/complaints', requireAuth, complaintController.createComplaintHandler);

// --- Admin ---
router.get('/admin/system/config', requireAuth, requireRole('admin'), systemController.getAdminSystemConfig);
router.post('/system/config', requireAuth, requireRole('admin'), systemController.updateSystemConfig);
router.post('/admin/addons', requireAuth, requireRole('admin'), productController.saveAddOnList);

router.get('/admin/orders', requireAuth, requireRole('admin'), adminController.getAdminOrders);
router.post('/admin/orders/:id/ship', requireAuth, requireRole('admin'), adminController.shipAdminOrder);

router.get('/admin/users', requireAuth, requireRole('admin'), adminController.getAdminUsers);
router.get('/admin/users/:id/points', requireAuth, requireRole('admin'), adminController.getAdminUserPoints);
router.get('/admin/users/:id/addresses', requireAuth, requireRole('admin'), adminController.getAdminUserAddresses);
router.get('/admin/users/:id/orders', requireAuth, requireRole('admin'), adminController.getAdminUserOrders);

router.get('/admin/complaints', requireAuth, requireRole('admin'), adminController.getAdminComplaints);
router.get('/admin/complaints/:id', requireAuth, requireRole('admin'), adminController.getAdminComplaintById);
router.post('/admin/complaints/:id/resolve', requireAuth, requireRole('admin'), adminController.resolveAdminComplaint);
router.post('/admin/complaints/:id/reject', requireAuth, requireRole('admin'), adminController.resolveAdminComplaint);
router.post('/admin/complaints/:id/reply', requireAuth, requireRole('admin'), adminController.resolveAdminComplaint);

router.get('/admin/withdrawals', requireAuth, requireRole('admin'), adminController.getAdminWithdrawals);
router.post('/admin/withdrawals/:id/approve', requireAuth, requireRole('admin'), adminController.approveAdminWithdrawal);
router.post('/admin/withdrawals/:id/reject', requireAuth, requireRole('admin'), adminController.rejectAdminWithdrawal);

router.delete('/admin/plaza/:id', requireAuth, requireRole('admin'), productController.deletePlazaDesign);
router.post('/admin/plaza/:id/pin', requireAuth, requireRole('admin'), productController.pinPlazaDesign);

router.get('/admin/coupons/templates', requireAuth, requireRole('admin'), adminController.getAdminCouponTemplates);
router.post('/admin/coupons/templates', requireAuth, requireRole('admin'), adminController.createAdminCouponTemplate);
router.put('/admin/coupons/templates/:id', requireAuth, requireRole('admin'), adminController.updateAdminCouponTemplate);
router.post('/admin/coupons/issue', requireAuth, requireRole('admin'), adminController.issueAdminCoupons);
router.get('/admin/coupons/stats', requireAuth, requireRole('admin'), adminController.getAdminCouponStats);

router.get('/admin/analytics', requireAuth, requireRole('admin'), adminController.getAdminAnalytics);
router.get('/admin/ops/self-check', requireAuth, requireRole('admin'), adminController.getAdminOpsCheck);
router.get('/admin/audit-logs', requireAuth, requireRole('admin'), adminController.getAdminAuditLogs);

// --- Admin AI / 社区模块 ---
router.get('/admin/ai/providers', requireAuth, requireRole('admin'), aiAdminController.getProviders);
router.put('/admin/ai/providers/:provider', requireAuth, requireRole('admin'), aiAdminController.putProvider);
router.post('/admin/ai/providers/:provider/test', requireAuth, requireRole('admin'), aiAdminController.testProvider);

router.get('/admin/ai/models', requireAuth, requireRole('admin'), aiAdminController.getModels);
router.post('/admin/ai/models', requireAuth, requireRole('admin'), aiAdminController.postModel);
router.put('/admin/ai/models/:id', requireAuth, requireRole('admin'), aiAdminController.putModel);

router.get('/admin/ai/router-rules', requireAuth, requireRole('admin'), aiAdminController.getRouterRules);
router.put('/admin/ai/router-rules', requireAuth, requireRole('admin'), aiAdminController.putRouterRules);

router.get('/admin/ai/prompts', requireAuth, requireRole('admin'), aiAdminController.getPrompts);
router.post('/admin/ai/prompts', requireAuth, requireRole('admin'), aiAdminController.postPrompt);
router.put('/admin/ai/prompts/:id', requireAuth, requireRole('admin'), aiAdminController.putPrompt);

router.get('/admin/ai/policies', requireAuth, requireRole('admin'), aiAdminController.getPolicies);
router.put('/admin/ai/policies/:key', requireAuth, requireRole('admin'), aiAdminController.putPolicy);

router.get('/admin/ai/tag-mappings', requireAuth, requireRole('admin'), aiAdminController.getTagMappings);
router.put('/admin/ai/tag-mappings/:tag', requireAuth, requireRole('admin'), aiAdminController.putTagMapping);

router.get('/admin/ai/dashboard', requireAuth, requireRole('admin'), aiAdminController.getDashboard);

router.get('/admin/points/rules', requireAuth, requireRole('admin'), adminController.getAdminPointsRules);
router.post('/admin/points/rules', requireAuth, requireRole('admin'), adminController.createAdminPointsRule);
router.put('/admin/points/rules/:id', requireAuth, requireRole('admin'), adminController.updateAdminPointsRule);
router.post('/admin/points/rules/:id/toggle', requireAuth, requireRole('admin'), adminController.togglePointsRuleStatus);

router.get('/admin/points/campaigns', requireAuth, requireRole('admin'), adminController.getAdminPointsCampaigns);
router.post('/admin/points/campaigns', requireAuth, requireRole('admin'), adminController.createAdminPointsCampaign);
router.put('/admin/points/campaigns/:id', requireAuth, requireRole('admin'), adminController.updateAdminPointsCampaign);
router.post('/admin/points/campaigns/:id/toggle', requireAuth, requireRole('admin'), adminController.togglePointsCampaignStatus);

router.get('/admin/points/risk-rules', requireAuth, requireRole('admin'), adminController.getAdminPointsRiskRules);
router.post('/admin/points/risk-rules', requireAuth, requireRole('admin'), adminController.createAdminPointsRiskRule);
router.put('/admin/points/risk-rules/:id', requireAuth, requireRole('admin'), adminController.updateAdminPointsRiskRule);
router.post('/admin/points/risk-rules/:id/toggle', requireAuth, requireRole('admin'), adminController.togglePointsRiskRuleStatus);

router.get('/admin/points/ledger', requireAuth, requireRole('admin'), adminController.getAdminPointsLedger);
router.get('/admin/points/grants', requireAuth, requireRole('admin'), adminController.getAdminPointsGrantTasks);
router.post('/admin/points/grants', requireAuth, requireRole('admin'), adminController.createAdminPointsGrantTask);
router.get('/admin/points/dashboard', requireAuth, requireRole('admin'), adminController.getAdminPointsDashboardView);

export default router;


