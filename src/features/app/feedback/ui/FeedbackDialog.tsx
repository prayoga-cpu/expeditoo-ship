"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, MessageSquarePlus, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { useLocale } from "@/components/providers/LocaleProvider";
import { cn } from "@/lib/utils";

import {
  FEEDBACK_SURFACES,
  MAX_FEEDBACK_SCREENSHOTS,
  MIN_FEEDBACK_DESCRIPTION,
  MAX_FEEDBACK_DESCRIPTION,
  type FeedbackSurface,
} from "@/server/dto/feedback.dto";
import {
  feedbackTypeEnum,
  type FeedbackTypeValue,
} from "@/db/schema/feedback";
import { uploadFeedbackScreenshot } from "../api/feedback.api";
import { useMyFeedback, useSubmitFeedback } from "../hooks/useFeedback";

/**
 * Where each surface lives, so the dialog can pre-select "Where?" from the URL.
 *
 * Matched by LONGEST prefix, not first hit, and that is not a nicety:
 * `/carrier/trips` and `/carrier/application` share a prefix, and `/listings/me`
 * and `/listing/:id` differ by a single character.
 */
const SURFACE_ROUTES: Record<Exclude<FeedbackSurface, "other">, string> = {
  home: "/home",
  board: "/expedion",
  create: "/create",
  myRequests: "/listings/me",
  jobDetail: "/listing",
  deliveries: "/deliveries",
  messages: "/messages",
  trips: "/carrier/trips",
  earnings: "/carrier/withdrawals",
  application: "/carrier/application",
  profile: "/profile",
  driver: "/driver",
  admin: "/admin",
};

export function surfaceForPath(pathname: string | null): FeedbackSurface {
  if (!pathname) return "other";
  let best: FeedbackSurface = "other";
  let bestLength = 0;
  for (const [surface, route] of Object.entries(SURFACE_ROUTES)) {
    if (
      (pathname === route || pathname.startsWith(`${route}/`)) &&
      route.length > bestLength
    ) {
      best = surface as FeedbackSurface;
      bestLength = route.length;
    }
  }
  return best;
}

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const t = useTranslations("feedback");
  const pathname = usePathname();
  const { locale } = useLocale();
  const submit = useSubmitFeedback();

  const [tab, setTab] = useState("new");
  const [type, setType] = useState<FeedbackTypeValue>("bug");
  const [surface, setSurface] = useState<FeedbackSurface>("other");
  const [description, setDescription] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [sentRef, setSentRef] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Recomputed each time the dialog opens, so reopening on a different page
  // re-defaults rather than keeping the first page it ever saw.
  useEffect(() => {
    if (open) setSurface(surfaceForPath(pathname));
  }, [open, pathname]);

  useEffect(() => {
    if (open) return;
    setTab("new");
    setType("bug");
    setDescription("");
    setScreenshots([]);
    setSentRef(null);
    setIsUploading(false);
  }, [open]);

  const isSubmitting = isUploading || submit.isPending;
  const canSubmit =
    description.trim().length >= MIN_FEEDBACK_DESCRIPTION && !isSubmitting;

  /** Refuses to close mid-flight — otherwise the reset races the mutation. */
  function handleOpenChange(next: boolean) {
    if (!next && isSubmitting) return;
    onOpenChange(next);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_FEEDBACK_SCREENSHOTS - screenshots.length;
    if (room <= 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files).slice(0, room)) {
        try {
          const url = await uploadFeedbackScreenshot(file);
          // Kept one at a time: re-picking every image because the last one
          // failed is a worse answer than a partial set.
          setScreenshots((prev) => [...prev, url]);
        } catch {
          toast.error(t("toast.uploadFailed"));
        }
      }
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleSubmit() {
    const view = await submit.mutateAsync({
      type,
      surface,
      pathname: pathname ?? undefined,
      description: description.trim(),
      screenshotUrls: screenshots,
      locale,
    });
    setSentRef(view.id.slice(-8).toUpperCase());
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>

        {sentRef ? (
          <SentStep reference={sentRef} onDone={() => onOpenChange(false)} />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">{t("tabs.new")}</TabsTrigger>
              <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{t("fields.type")}</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as FeedbackTypeValue)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {feedbackTypeEnum.enumValues.map((v) => (
                      <SelectItem key={v} value={v}>
                        {t(`types.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("fields.surface")}</Label>
                <Select
                  value={surface}
                  onValueChange={(v) => setSurface(v as FeedbackSurface)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEEDBACK_SURFACES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`surfaces.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-description">
                  {t("fields.description")}
                </Label>
                <Textarea
                  id="feedback-description"
                  rows={5}
                  maxLength={MAX_FEEDBACK_DESCRIPTION}
                  value={description}
                  disabled={isSubmitting}
                  placeholder={t("fields.descriptionPlaceholder")}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("fields.descriptionHint", { min: MIN_FEEDBACK_DESCRIPTION })}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("fields.screenshots")}</Label>
                <div className="flex flex-wrap gap-2">
                  {screenshots.map((url) => (
                    <div key={url} className="relative h-16 w-16">
                      <img
                        src={url}
                        alt=""
                        className="h-16 w-16 rounded-md border object-cover"
                      />
                      <button
                        type="button"
                        aria-label={t("fields.removeScreenshot")}
                        disabled={isSubmitting}
                        onClick={() =>
                          setScreenshots((prev) => prev.filter((u) => u !== url))
                        }
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {screenshots.length < MAX_FEEDBACK_SCREENSHOTS && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => fileInput.current?.click()}
                      aria-label={t("fields.addScreenshot")}
                      className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("fields.screenshotsHint", { max: MAX_FEEDBACK_SCREENSHOTS })}
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => handleOpenChange(false)}
                >
                  {t("actions.cancel")}
                </Button>
                <Button disabled={!canSubmit} onClick={handleSubmit}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isSubmitting ? t("actions.submitting") : t("actions.submit")}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* No submit button here on purpose: TabsContent unmounts the form
                above, so a shared footer button would be a silent no-op. */}
            <TabsContent value="history" className="pt-4">
              <MyFeedbackList enabled={open && tab === "history"} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SentStep({
  reference,
  onDone,
}: {
  reference: string;
  onDone: () => void;
}) {
  const t = useTranslations("feedback");
  return (
    <div className="space-y-4 py-6 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
      <div className="space-y-1">
        <p className="font-semibold">{t("success.title")}</p>
        <p className="text-sm text-muted-foreground">{t("success.message")}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {t("success.reference", { ref: reference })}
        </p>
      </div>
      <Button onClick={onDone}>{t("actions.done")}</Button>
    </div>
  );
}

const TYPE_TONE: Record<FeedbackTypeValue, "destructive" | "default" | "secondary"> = {
  bug: "destructive",
  idea: "default",
  general: "secondary",
};

function MyFeedbackList({ enabled }: { enabled: boolean }) {
  const t = useTranslations("feedback");
  const { feedback, isLoading, isError, refetch } = useMyFeedback(enabled);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Never a blank panel on failure (CLAUDE.md §Gotchas 9).
  if (isError) {
    return (
      <CenteredEmptyState icon={MessageSquarePlus} title={t("history.error")}>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t("actions.retry")}
        </Button>
      </CenteredEmptyState>
    );
  }

  if (feedback.length === 0) {
    return (
      <CenteredEmptyState
        icon={MessageSquarePlus}
        title={t("history.emptyTitle")}
        description={t("history.emptyDescription")}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {feedback.map((item) => (
        <li key={item.id} className="rounded-lg border p-3 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant={TYPE_TONE[item.type]}>{t(`types.${item.type}`)}</Badge>
            <Badge variant="outline">{t(`statuses.${item.status}`)}</Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {t("history.reference")} #{item.id.slice(-8).toUpperCase()}
            </span>
          </div>
          <p className={cn("line-clamp-2 text-muted-foreground")}>
            {item.description}
          </p>
        </li>
      ))}
    </ul>
  );
}
