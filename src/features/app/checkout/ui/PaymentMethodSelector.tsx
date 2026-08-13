"use client";

import type React from "react";

import { CreditCard, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentMethod {
  id: string;
  type: "card" | "bank";
  name: string;
  icon: React.ReactNode;
  details: string;
}

interface PaymentMethodSelectorProps {
  selected?: string;
  onSelect: (id: string) => void;
}

export function PaymentMethodSelector({
  selected,
  onSelect,
}: PaymentMethodSelectorProps) {
  const methods: PaymentMethod[] = [
    {
      id: "card",
      type: "card",
      name: "Carte Bancaire",
      icon: <CreditCard className="w-5 h-5" />,
      details: "Visa, Mastercard, Amex",
    },
    {
      id: "bank",
      type: "bank",
      name: "Virement Bancaire",
      icon: <Banknote className="w-5 h-5" />,
      details: "Virement direct en 2-3 jours",
    },
  ];

  return (
    <div className="space-y-3">
      {methods.map((method) => (
        <button
          key={method.id}
          onClick={() => onSelect(method.id)}
          className={cn(
            "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ease-out",
            selected === method.id
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/30",
          )}
        >
          <div
            className={cn(
              "p-3 rounded-lg",
              selected === method.id
                ? "bg-primary text-white"
                : "bg-muted text-foreground",
            )}
          >
            {method.icon}
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-foreground">{method.name}</p>
            <p className="text-xs text-muted-foreground">{method.details}</p>
          </div>
          <div
            className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center",
              selected === method.id
                ? "border-primary bg-primary"
                : "border-border",
            )}
          >
            {selected === method.id && (
              <div className="w-2 h-2 bg-white rounded-full" />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
