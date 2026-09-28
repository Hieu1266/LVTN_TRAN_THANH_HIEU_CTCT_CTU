"use client";

import { useState, useRef, useEffect } from "react";

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    time: string;
    isRead: boolean;
    type: "course" | "system" | "achievement";
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Số thông báo chưa đọc
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    // Xử lý sự kiện click ra bên ngoài để đóng Dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Đánh dấu 1 thông báo là đã đọc
    const handleMarkAsRead = (id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
    };

    // Đánh dấu tất cả là đã đọc
    const handleMarkAllAsRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    };

    // Icon minh họa theo loại thông báo
    const renderIcon = (type: NotificationItem["type"]) => {
        switch (type) {
            case "course":
                return (
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        📚
                    </div>
                );
            case "achievement":
                return (
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        🏆
                    </div>
                );
            case "system":
                return (
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        ⚙️
                    </div>
                );
        }
    };

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            {/* Nút Chuông Thông Báo */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all duration-200 focus:outline-none cursor-pointer"
                aria-label="Thông báo"
            >
                <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                </svg>

                {/* Huy hiệu (Badge) đếm số thông báo mới */}
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Menu Dropdown Thông Báo */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden z-50 transition-all">

                    {/* Header */}
                    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-sm">Thông báo</h3>
                            {unreadCount > 0 && (
                                <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                    {unreadCount} mới
                                </span>
                            )}
                        </div>

                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition cursor-pointer"
                            >
                                Đọc tất cả
                            </button>
                        )}
                    </div>

                    {/* Danh sách thông báo */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length > 0 ? (
                            notifications.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleMarkAsRead(item.id)}
                                    className={`p-4 flex gap-3.5 items-start hover:bg-slate-50 transition cursor-pointer relative ${!item.isRead ? "bg-blue-50/30" : ""
                                        }`}
                                >
                                    {renderIcon(item.type)}

                                    <div className="flex-1 min-w-0">
                                        <p
                                            className={`text-xs font-semibold leading-tight ${!item.isRead ? "text-slate-900 font-bold" : "text-slate-700"
                                                }`}
                                        >
                                            {item.title}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                            {item.message}
                                        </p>
                                        <span className="text-[10px] text-slate-400 mt-1.5 block">
                                            {item.time}
                                        </span>
                                    </div>

                                    {/* Chấm xanh đánh dấu chưa đọc */}
                                    {!item.isRead && (
                                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-slate-400 text-xs">
                                Không có thông báo nào.
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-100 text-center bg-slate-50/50">
                        <button className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition cursor-pointer">
                            Xem tất cả thông báo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}