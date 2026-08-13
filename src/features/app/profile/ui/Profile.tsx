"use client";

import { useRef, useState, useEffect, type ChangeEvent } from "react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PaymentMethods } from "./PaymentMethods";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MapPin,
  CreditCard,
  Gavel,
  Star,
  Settings,
  Plus,
  Edit2,
  Shield,
  HelpCircle,
  Headset,
  Truck,
  LogOut,
  Camera,
  Trash2,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useProfile } from "../hooks/useProfile";
import type { LucideIcon } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useUserRoles } from "../hooks/useUserRoles";
import { PageLoader } from "@/components/ui/page-loader";
import { PageWrapper } from "@/components/ui/page-wrapper";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function Profile() {
  const {
    user,
    cards,
    isAddCardOpen,
    setIsAddCardOpen,
    newCard,
    setNewCard,
    handleAddCard,
    handleDeleteCard,
    handleLogout,
    isUploadingImage,
    uploadProfilePicture,
    removeProfilePicture,
    isLoading,
  } = useProfile();

  const { data: userRoles, isLoading: isRolesLoading } = useUserRoles();

  const t = useTranslations("profile");

  // File input ref for profile picture
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const handleUploadClick = () => {
    setIsAvatarModalOpen(false);
    fileInputRef.current?.click();
  };

  const handleRemoveClick = () => {
    setIsAvatarModalOpen(false);
    removeProfilePicture();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadProfilePicture(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* Prevent hydration mismatch by ensuring we only show content after mount if loading state might differ */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect context for responsive loading height
  const pathname = usePathname();
  const isDriver = pathname?.includes("/driver");
  const isAdmin = pathname?.includes("/admin");

  if (!mounted || isLoading || isRolesLoading) {
    return (
      <PageLoader
        variant={isAdmin ? "admin" : isDriver ? "driver" : "default"}
      />
    );
  }

  if (!user) {
    return null; // Or redirect
  }

  return (
    <PageWrapper noPadding>
      {/* Hidden file input for profile picture */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-center">
            <div className="relative">
              <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background shadow-xl">
                <AvatarImage
                  src={user?.image || undefined}
                  referrerPolicy="no-referrer"
                />
                <AvatarFallback className="text-2xl font-bold bg-linear-to-br from-primary to-accent-pink text-white">
                  {user?.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {/* Profile Picture Modal */}
              <Dialog
                open={isAvatarModalOpen}
                onOpenChange={setIsAvatarModalOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 right-0 rounded-full shadow-md w-8 h-8"
                    disabled={isUploadingImage}
                  >
                    {isUploadingImage ? (
                      <LottieLoader width={20} height={20} />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{t("picture.title")}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-12"
                      onClick={handleUploadClick}
                    >
                      <Camera className="w-5 h-5" />
                      {t("picture.upload")}
                    </Button>
                    {user?.image && (
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive"
                        onClick={handleRemoveClick}
                      >
                        <Trash2 className="w-5 h-5" />
                        {t("picture.remove")}
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center justify-center md:justify-start gap-2">
                {user.name}
                {user.isVerified && <VerifiedBadge size={24} />}
              </h1>
              <p className="text-muted-foreground mb-2">{user.email}</p>
              <div className="flex items-center gap-2 mb-4 justify-center md:justify-start">
                <div className="flex items-center text-yellow-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="ml-1 font-medium">{user.rating}</span>
                </div>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {user.reviews} {t("header.reviews")}
                </span>
              </div>
              <div className="flex gap-3 justify-center md:justify-start">
                <Link href="/settings">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    {t("header.settings")}
                  </Button>
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  {t("header.logout")}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Quick Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("quickLinks.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickLinks userRoles={userRoles} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Address Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-primary" />
                {t("address.title")}
              </CardTitle>
              <Link
                href={
                  user.address.street
                    ? "/profile/addresses"
                    : "/profile/addresses/create"
                }
              >
                <Button variant="ghost" size="sm">
                  {user.address.street ? (
                    <Edit2 className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {user.address.street ? (
                <div className="space-y-1">
                  <p className="font-medium">{user.address.street}</p>
                  <p className="text-muted-foreground">
                    {user.address.city}, {user.address.zip}
                  </p>
                  <p className="text-muted-foreground">
                    {user.address.country}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("address.noAddress")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods (For Buyers) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="w-5 h-5 text-primary" />
                {t("paymentMethods.title")}
              </CardTitle>
              <Link href="/profile/payment-methods">
                <Button variant="ghost" size="sm">
                  <Edit2 className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {t("paymentMethods.description")}
              </p>
            </CardContent>
          </Card>

          {/* Payout Configuration (Stripe Connect) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5 text-primary" />
                {t("payout.title")}
              </CardTitle>
              {user.stripeAccountStatus === "active" ? (
                <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full text-xs font-medium">
                  {t("payout.status.active")}
                </span>
              ) : (
                <span className="text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full text-xs font-medium">
                  {user.stripeAccountStatus === "pending"
                    ? t("payout.status.pending")
                    : t("payout.status.notConnected")}
                </span>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <p className="text-muted-foreground text-sm">
                  {user.stripeAccountStatus === "active"
                    ? t("payout.description.active")
                    : t("payout.description.inactive")}
                </p>
                {user.stripeAccountStatus !== "active" && (
                  <Button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/stripe/connect", {
                          method: "POST",
                        });
                        const data = await res.json();
                        if (data.url) window.location.href = data.url;
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="w-full sm:w-auto self-start"
                  >
                    {user.stripeAccountStatus === "pending"
                      ? t("payout.button.continue")
                      : t("payout.button.connect")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}

const baseQuickLinks: { href: string; labelKey: string; icon: LucideIcon }[] = [
  {
    href: "/my-auctions",
    labelKey: "myAuctions",
    icon: Gavel,
  },
  {
    href: "/my-bids",
    labelKey: "myBids",
    icon: Gavel,
  },
  {
    href: "/earnings",
    labelKey: "earnings",
    icon: TrendingUp,
  },
  {
    href: "/profile/reviews",
    labelKey: "myReviews",
    icon: Star,
  },
  {
    href: "/profile/payment-methods",
    labelKey: "paymentMethods",
    icon: CreditCard,
  },
  {
    href: "/help",
    labelKey: "contactHelp",
    icon: HelpCircle,
  },
];

function QuickLinks({ userRoles }: { userRoles?: string[] }) {
  const t = useTranslations("profile.quickLinks");
  const pathname = usePathname();
  const isAdmin = userRoles?.includes("admin");
  const isDriver =
    userRoles?.includes("transporter") || userRoles?.includes("driver");

  const isAdminProfile = pathname?.startsWith("/admin");
  const isDriverProfile = pathname?.startsWith("/driver");

  // If we are on the Admin Profile page, show ONLY relevant admin links that aren't in the bottom nav
  if (isAdminProfile && isAdmin) {
    const adminLinks = [
      {
        href: "/admin/users",
        labelKey: "adminUsers",
        icon: Users,
      },
      {
        href: "/admin/payments",
        labelKey: "adminPayments",
        icon: DollarSign,
      },
      {
        href: "/admin/support",
        labelKey: "adminSupport",
        icon: Headset,
      },
    ];

    return (
      <>
        {adminLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Button variant="ghost" className="w-full justify-start gap-3 h-12 group">
              <link.icon className="w-5 h-5 text-primary group-hover:text-accent-foreground" />
              <span>{t(link.labelKey)}</span>
            </Button>
          </Link>
        ))}
      </>
    );
  }

  // If we are on the Driver Profile page, show ONLY relevant driver links that aren't in the bottom nav
  if (isDriverProfile && isDriver) {
    const driverLinks = [
      {
        href: "/earnings",
        labelKey: "earnings",
        icon: TrendingUp,
      },
      {
        href: "/profile/reviews",
        labelKey: "myReviews",
        icon: Star,
      },
      {
        href: "/driver/help",
        labelKey: "driverSupport",
        icon: HelpCircle,
      },
    ];

    return (
      <>
        {driverLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Button variant="ghost" className="w-full justify-start gap-3 h-12 group">
              <link.icon className="w-5 h-5 text-primary group-hover:text-accent-foreground" />
              <span>{t(link.labelKey)}</span>
            </Button>
          </Link>
        ))}
      </>
    );
  }

  // Standard Profile Logic for general user profile page
  const links = [...baseQuickLinks];

  if (isAdmin) {
    links.unshift({
      href: "/admin/dashboard",
      labelKey: "adminDashboard",
      icon: Shield,
    });
    links.push({
      href: "/admin/support",
      labelKey: "adminSupport",
      icon: Headset,
    });
  }

  // Driver Logic - only add Link to Dashboard if we are on generic profile
  // If we are on generic profile (not /driver/...) but are a driver, we show link to dashboard.
  if (isDriver) {
    links.unshift({
      href: "/driver/dashboard",
      labelKey: "driverDashboard",
      icon: Truck,
    });
  } else {
    links.push({
      href: "/become-driver",
      labelKey: "becomeDriver",
      icon: Truck,
    });
  }

  return (
    <>
      {links.map((link) => (
        <Link key={link.href} href={`${link.href}?from=profile`}>
          <Button variant="ghost" className="w-full justify-start gap-3 h-12 group">
            <link.icon className="w-5 h-5 text-primary group-hover:text-accent-foreground" />
            <span>{t(link.labelKey)}</span>
          </Button>
        </Link>
      ))}
    </>
  );
}
