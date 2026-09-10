"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Archive,
  CheckCircle2,
  Clock,
  Eye,
  Inbox,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { cn } from "@/lib/utils";

import {
  feedbackPriorityEnum,
  feedbackStatusEnum,
  feedbackTypeEnum,
  type FeedbackPriorityValue,
  type FeedbackStatusValue,
  type FeedbackTypeValue,
} from "@/db/schema/feedback";
import type { AdminFeedbackView } from "@/server/dto/feedback.dto";
import { useFeedbackQueue, useTriageFeedback } from "../hooks/useFeedback";

const PAGE_SIZE = 25;
const DESCRIPTION_CLAMP = 200;

/**
 * Light and dark are both mandatory for every new surface here, so each hue is
 * an explicit pair rather than the single dark-tuned value the sibling product
 * uses — its `-400` text on a `-500/[0.03]` ground reads washed out on white.
 */
const STATUS_STYLE: Record<
  FeedbackStatusValue,
  { icon: typeof Inbox; tone: string }
> = {
  OPEN: { icon: Inbox, tone: "text-primary" },
  IN_PROGRESS: { icon: Clock, tone: "text-amber-600 dark:text-amber-400" },
  NEEDS_REVIEW: { icon: Eye, tone: "text-violet-600 dark:text-violet-400" },
  RESOLVED: {
    icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  ARCHIVED: { icon: Archive, tone: "text-muted-foreground" },
};

const TYPE_TONE: Record<
  FeedbackTypeValue,
  "destructive" | "default" | "secondary"
> = { bug: "destructive", idea: "default", general: "secondary" };

const PRIORITY_TONE: Record<FeedbackPriorityValue, string> = {
  urgent: "text-destructive",
  high: "text-amber-600 dark:text-amber-400",
  medium: "text-muted-foreground",
  low: "text-muted-foreground",
};

/**
 * The triage queue.
 *
 * No page header, no back button and no max-width wrapper: `AdminLayout`
 * already supplies the sticky header, the panel title, the way out and the
 * padding. See docs/specs/feedback_spec.md §5.
 */
export function FeedbackConsole() {
  const t = useTranslations("feedback");
  const [status, setStatus] = useState<FeedbackStatusValue | undefined>();
  const [type, setType] = useState<FeedbackTypeValue | undefined>();
  const [priority, setPriority] = useState<FeedbackPriorityValue | undefined>();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const { items, meta, isLoading, isError } = useFeedbackQueue({
    status,
    type,
    priority,
    search: search.trim() || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const hasFilters = Boolean(status || type || priority || search.trim());

  function clearFilters() {
    setStatus(undefined);
    setType(undefined);
    setPriority(undefined);
    setSearch("");
    setOffset(0);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("console.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("console.subtitle")}</p>
      </div>

      {/* Counts come from the server with the page, so a tile can never
          disagree with the list beneath it. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {feedbackStatusEnum.enumValues.map((s) => {
          const { icon: Icon, tone } = STATUS_STYLE[s];
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setStatus(active ? undefined : s);
                setOffset(0);
              }}
              className={cn(
                "rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50",
                active && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t(`statuses.${s}`)}
                </span>
                <Icon className={cn("h-4 w-4", tone)} />
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {meta?.counts?.[s] ?? 0}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder={t("console.search")}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            className="pl-8"
          />
        </div>

        <Select
          value={type ?? "all"}
          onValueChange={(v) => {
            setType(v === "all" ? undefined : (v as FeedbackTypeValue));
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("console.allTypes")}</SelectItem>
            {feedbackTypeEnum.enumValues.map((v) => (
              <SelectItem key={v} value={v}>
                {t(`types.${v}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={priority ?? "all"}
          onValueChange={(v) => {
            setPriority(v === "all" ? undefined : (v as FeedbackPriorityValue));
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("console.allPriorities")}</SelectItem>
            {feedbackPriorityEnum.enumValues.map((v) => (
              <SelectItem key={v} value={v}>
                {t(`priorities.${v}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t("console.clearFilters")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <CenteredEmptyState
          icon={MessageSquarePlus}
          title={t("console.error")}
        />
      ) : items.length === 0 ? (
        <CenteredEmptyState
          icon={MessageSquarePlus}
          title={
            hasFilters ? t("console.filteredEmptyTitle") : t("console.emptyTitle")
          }
          description={
            hasFilters
              ? t("console.filteredEmptyDescription")
              : t("console.emptyDescription")
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <FeedbackRow key={item.id} item={item} />
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
            <span>
              {t("console.showing", {
                shown: items.length,
                total: meta?.total ?? items.length,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                {t("console.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + items.length >= (meta?.total ?? 0)}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                {t("console.next")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FeedbackRow({ item }: { item: AdminFeedbackView }) {
  const t = useTranslations("feedback");
  const triage = useTriageFeedback();
  const [expanded, setExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(item.devNote ?? "");

  const reference = `#${item.id.slice(-8).toUpperCase()}`;
  const isLong = item.description.length > DESCRIPTION_CLAMP;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={TYPE_TONE[item.type]}>{t(`types.${item.type}`)}</Badge>
        <span className={cn("text-xs font-medium", PRIORITY_TONE[item.priority])}>
          {t(`priorities.${item.priority}`)}
        </span>
        <button
          type="button"
          title={t("console.copyReference")}
          onClick={() => {
            navigator.clipboard?.writeText(item.id);
            toast.success(t("console.referenceCopied"));
          }}
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          {reference}
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm">
        {expanded || !isLong
          ? item.description
          : `${item.description.slice(0, DESCRIPTION_CLAMP)}…`}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {expanded ? t("console.showLess") : t("console.showMore")}
        </button>
      )}

      {item.screenshotUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.screenshotUrls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              title={t("console.viewScreenshot")}
            >
              <img
                src={url}
                alt=""
                className="h-16 w-16 rounded-md border object-cover"
              />
            </a>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("console.reportedBy", {
          name: item.reporter.accountExists
            ? item.reporter.name
            : `${item.reporter.name} (${t("console.deletedAccount")})`,
          role: t(`roles.${item.userRole}`),
        })}
        {" · "}
        {t(`surfaces.${item.surface}`)}
        {" · v"}
        {item.appVersion}
        {" · "}
        {item.locale}
        {item.pathname ? ` · ${item.pathname}` : ""}
      </p>

      <div className="flex flex-wrap gap-2">
        <Select
          value={item.status}
          onValueChange={(v) =>
            triage.mutate({
              id: item.id,
              input: { status: v as FeedbackStatusValue },
            })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {feedbackStatusEnum.enumValues.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`statuses.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={item.priority}
          onValueChange={(v) =>
            triage.mutate({
              id: item.id,
              input: { priority: v as FeedbackPriorityValue },
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {feedbackPriorityEnum.enumValues.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`priorities.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Privacy is enforced by `toFeedbackView` omitting devNote, never by
          this component choosing not to render it. */}
      {editingNote ? (
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={note}
            placeholder={t("console.devNotePlaceholder")}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                triage.mutate({
                  id: item.id,
                  input: { devNote: note.trim() || null },
                });
                setEditingNote(false);
              }}
            >
              {t("console.saveNote")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNote(item.devNote ?? "");
                setEditingNote(false);
              }}
            >
              {t("console.cancelNote")}
            </Button>
          </div>
        </div>
      ) : item.devNote ? (
        <button
          type="button"
          onClick={() => setEditingNote(true)}
          className="flex w-full items-start gap-2 rounded-md border border-violet-500/20 bg-violet-500/10 p-2 text-left text-xs"
        >
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
          <span className="whitespace-pre-wrap">{item.devNote}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditingNote(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
          {t("console.addDevNote")}
        </button>
      )}
    </Card>
  );
}
