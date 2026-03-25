import { Bell, RefreshCw, Target, DollarSign, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const typeConfig: Record<string, { icon: typeof Bell; className: string }> = {
  renewal_due: { icon: RefreshCw, className: "text-orange-500 bg-orange-500/10" },
  lead_assigned: { icon: Target, className: "text-blue-500 bg-blue-500/10" },
  commission_paid: { icon: DollarSign, className: "text-emerald-500 bg-emerald-500/10" },
  commission_pending: { icon: DollarSign, className: "text-yellow-500 bg-yellow-500/10" },
};

function NotificationItem({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) {
  const config = typeConfig[notification.type] || { icon: Bell, className: "text-muted-foreground bg-muted" };
  const Icon = config.icon;

  return (
    <button
      onClick={() => !notification.is_read && onRead(notification.id)}
      className={`w-full text-left px-4 py-3 flex gap-3 items-start transition-colors hover:bg-accent/50 border-b border-border/50 last:border-0 ${
        notification.is_read ? "opacity-60" : ""
      }`}
    >
      <div className={`p-2 rounded-full shrink-0 ${config.className}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${notification.is_read ? "text-muted-foreground" : "text-foreground font-medium"}`}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      {!notification.is_read && (
        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
      )}
    </button>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 bg-destructive rounded-full text-[10px] flex items-center justify-center text-destructive-foreground font-medium">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1" onClick={markAllAsRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onRead={markAsRead} />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
