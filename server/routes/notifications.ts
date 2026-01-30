import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, getUnreadCount } from '../services/notificationService';

const router = Router();
router.use(authenticate);

// Get user notifications
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const includeRead = req.query.includeRead === 'true';
  
  const notifications = await getUserNotifications(req.user!.id, limit, includeRead);
  const unreadCount = await getUnreadCount(req.user!.id);
  
  res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
    },
  });
}));

// Get unread count
router.get('/unread-count', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const count = await getUnreadCount(req.user!.id);
  res.json({ success: true, data: { count } });
}));

// Mark single notification as read
router.post('/:notificationId/read', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { notificationId } = req.params;
  await markNotificationRead(notificationId, req.user!.id);
  res.json({ success: true, message: 'Notification marked as read' });
}));

// Mark all notifications as read
router.post('/read-all', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await markAllNotificationsRead(req.user!.id);
  res.json({ success: true, message: 'All notifications marked as read' });
}));

export { router as notificationsRouter };
