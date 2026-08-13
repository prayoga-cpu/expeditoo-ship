"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Headset, Search, MessageCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/ui/page-loader";
import { useSupportChats } from "../hooks/useSupportChats";
import { useTranslations } from "next-intl";

interface SupportChat {
    conversationId: string;
    type: string;
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
    };
    lastMessage: {
        content: string;
        createdAt: Date;
        senderId: string;
    } | null;
    unreadCount: number;
    lastMessageAt: Date | null;
    createdAt: Date;
}

export function AdminSupportChats() {
    const router = useRouter();
    const t = useTranslations("admin.support");
    const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const { chats: rawChats, isLoading, refetch } = useSupportChats(activeTab);

    // Client-side search filtering
    const filteredChats = rawChats.filter((chat: SupportChat) =>
        !searchQuery ||
        chat.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatTimestamp = (date: Date | null) => {
        if (!date) return t("time.noMessages");

        const now = new Date();
        const messageDate = new Date(date);
        const diffMs = now.getTime() - messageDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t("time.justNow");
        if (diffMins < 60) return t("time.minAgo", { count: diffMins });
        if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
        if (diffDays === 1) return t("time.yesterday");
        if (diffDays < 7) return t("time.daysAgo", { count: diffDays });

        return messageDate.toLocaleDateString();
    };

    if (isLoading) {
        return <PageLoader variant="admin" />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Headset className="w-8 h-8 text-primary" />
                        {t("title")}
                    </h2>
                    <p className="text-muted-foreground">
                        {t("subtitle")}
                    </p>
                </div>
                <Button onClick={() => refetch()} variant="outline" size="sm">
                    {t("refresh")}
                </Button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder={t("searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "unread")}>
                <TabsList>
                    <TabsTrigger value="all">
                        {t("tabs.all")}
                    </TabsTrigger>
                    <TabsTrigger value="unread">
                        {t("tabs.unread")}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {filteredChats.length === 0 ? (
                        <Card className="min-h-[40vh]">
                            <CardContent className="flex flex-col items-center justify-center py-12 min-h-[40vh]">
                                <MessageCircle className="w-12 h-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">
                                    {activeTab === "unread" ? t("empty.unreadTitle") : t("empty.allTitle")}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {activeTab === "unread"
                                        ? t("empty.unreadDesc")
                                        : t("empty.allDesc")}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3 min-h-[40vh]">
                            {filteredChats.map((chat: SupportChat) => (
                                <Card
                                    key={chat.conversationId}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => router.push(`/admin/support/${chat.conversationId}`)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                            {/* Avatar */}
                                            <Avatar className="w-12 h-12">
                                                <AvatarImage src={chat.user.image || undefined} />
                                                <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white">
                                                    {chat.user.name.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <h3 className="font-semibold truncate">
                                                            {chat.user.name}
                                                        </h3>
                                                        {chat.unreadCount > 0 && (
                                                            <Badge variant="default" className="shrink-0">
                                                                {chat.unreadCount}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground shrink-0">
                                                        {formatTimestamp(chat.lastMessageAt)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground mb-1">
                                                    {chat.user.email}
                                                </p>
                                                {chat.lastMessage && (
                                                    <p className="text-sm text-muted-foreground truncate">
                                                        {chat.lastMessage.content}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
