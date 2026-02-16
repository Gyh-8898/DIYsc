import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

type ComplaintStatus = 'pending' | 'processing' | 'resolved' | 'rejected';

interface ReplyMessage {
  id: string;
  sender: 'admin' | 'system';
  content: string;
  createdAt: number;
}

const COMPLAINT_STATUS = {
  pending: 'pending'
} as const;

function parseReplyMessages(rawReply: string | null | undefined): ReplyMessage[] {
  const text = String(rawReply || '').trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any): ReplyMessage | null => {
        if (!item || typeof item !== 'object') return null;
        const content = String(item.content || '').trim();
        if (!content) return null;
        return {
          id: String(item.id || `reply_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`),
          sender: item.sender === 'system' ? 'system' : 'admin',
          content,
          createdAt: Number(item.createdAt || Date.now())
        };
      })
      .filter((item): item is ReplyMessage => Boolean(item));
  } catch (_error) {
    return text ? [{ id: 'legacy_reply', sender: 'admin', content: text, createdAt: Date.now() }] : [];
  }
}

function serializeReplyMessages(messages: ReplyMessage[]): string {
  if (!messages.length) return '';
  return JSON.stringify(messages);
}

function toComplaintDto(item: any) {
  let images: string[] = [];
  try {
    images = item.images ? JSON.parse(item.images) : [];
  } catch (_error) {
    images = [];
  }

  const replyMessages = parseReplyMessages(item.reply);
  const latestReply = replyMessages.length > 0 ? replyMessages[replyMessages.length - 1].content : '';

  return {
    id: item.id,
    userId: item.userId,
    userName: item.user?.name || '',
    type: item.type,
    title: item.title,
    description: item.content,
    images,
    contact: item.contact || '',
    status: item.status,
    reply: latestReply,
    replyMessages,
    createdAt: new Date(item.createdAt).getTime(),
    updatedAt: new Date(item.updatedAt).getTime(),
    resolvedAt: item.resolvedAt ? new Date(item.resolvedAt).getTime() : undefined
  };
}

export async function listUserComplaints(userId: string) {
  const list = await prisma.complaint.findMany({
    where: { userId },
    include: {
      user: {
        select: {
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return list.map(toComplaintDto);
}

export async function createComplaint(
  userId: string,
  payload: {
    type: 'complaint' | 'appeal';
    title: string;
    content: string;
    contact?: string;
    images?: string[];
  }
) {
  if (!payload.title || !payload.content) {
    throw new AppError(90001, '标题和内容不能为空', 400);
  }

  const created = await prisma.complaint.create({
    data: {
      userId,
      type: payload.type,
      title: payload.title,
      content: payload.content,
      contact: payload.contact || '',
      images: JSON.stringify(payload.images || []),
      status: COMPLAINT_STATUS.pending
    },
    include: {
      user: {
        select: {
          name: true
        }
      }
    }
  });

  await prisma.notification.create({
    data: {
      userId,
      complaintId: created.id,
      type: 'complaint',
      title: '投诉工单已提交',
      content: `工单《${created.title}》已提交，我们会尽快处理。`
    }
  });

  return toComplaintDto(created);
}

export async function listAdminComplaints() {
  const list = await prisma.complaint.findMany({
    include: {
      user: {
        select: {
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return list.map(toComplaintDto);
}

export async function getAdminComplaintDetail(complaintId: string) {
  const item = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: {
      user: {
        select: {
          name: true
        }
      }
    }
  });

  if (!item) {
    throw new AppError(90002, '投诉不存在', 404);
  }

  return toComplaintDto(item);
}

export async function updateComplaintStatus(
  complaintId: string,
  payload: {
    status: ComplaintStatus;
    reply?: string;
  }
) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) {
    throw new AppError(90002, '投诉不存在', 404);
  }

  const status: ComplaintStatus =
    payload.status === 'processing' || payload.status === 'resolved' || payload.status === 'rejected'
      ? payload.status
      : 'processing';

  const nextMessages = parseReplyMessages(complaint.reply);
  const replyText = String(payload.reply || '').trim();
  if (replyText) {
    nextMessages.push({
      id: `reply_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
      sender: 'admin',
      content: replyText,
      createdAt: Date.now()
    });
  }

  const updated = await prisma.complaint.update({
    where: { id: complaintId },
    data: {
      status,
      reply: serializeReplyMessages(nextMessages),
      resolvedAt: status === 'resolved' || status === 'rejected' ? new Date() : complaint.resolvedAt
    },
    include: {
      user: {
        select: {
          name: true
        }
      }
    }
  });

  await prisma.notification.create({
    data: {
      userId: updated.userId,
      complaintId,
      type: 'complaint',
      title: `工单状态更新：${status}`,
      content: replyText || `工单《${updated.title}》状态已更新为 ${status}`
    }
  });

  return toComplaintDto(updated);
}

