"use client";

import { PageLoader } from "@/components/ui/page-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Trash2, Plus, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function PaymentMethods() {
  const t = useTranslations("profile.paymentMethods");
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMethods = async () => {
    // Keep loading true initially or set it if needed manually, 
    // but typically we want to show full page load on first fetch
    try {
      const res = await fetch("/api/stripe/payment-methods");
      const data = await res.json();
      if (Array.isArray(data)) {
        setMethods(data);
      }
    } catch (e) {
      console.error(e);
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      const res = await fetch(`/api/stripe/payment-methods?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("deleteSuccess"));
        // Refetch without setting global loading to true to avoid flashing full page loader
        // Or we can just filter the local state
        setMethods(prev => prev.filter(m => m.id !== id));
      } else {
        toast.error(t("deleteError"));
      }
    } catch (e) {
      toast.error(t("deleteError"));
    }
  };

  if (loading) {
    return <PageLoader variant="padded" />;
  }

  return (
    <>
      <div className="flex items-start gap-4 mb-6">
        <Link href="/profile">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="w-5 h-5 text-primary" />
            {t("savedCards")}
          </CardTitle>
          <Link href="/profile/payment-methods/create">
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" /> {t("addNew")}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {methods.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">{t("emptyTitle")}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {t("emptyDesc")}
                </p>
                <Link href="/profile/payment-methods/create">
                  <Button variant="default">{t("addFirst")}</Button>
                </Link>
              </div>
            ) : (
              methods.map((m) => (
                <div
                  key={m.id}
                  className="flex justify-between items-center border p-3 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-muted p-2 rounded">
                      <CreditCard className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium capitalize text-sm">
                        {m.card.brand} •••• {m.card.last4}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("expires")} {m.card.exp_month}/{m.card.exp_year}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(m.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
