"use client";

import { useRef, useState, useEffect, type ChangeEvent } from "react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Route,
  CreditCard,
  Star,
  Settings,
  Edit2,
  Shield,
  HelpCircle,
  Headset,
  Truck,
  ClipboardList,
  LogOut,
  Camera,
  Trash2,
  TrendingUp,
  Users,
  DollarSign,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { useProfile } from "../hooks/useProfile";
import { SavedAddressesCard } from "./SavedAddressesCard";
import { ContactDetailsCard } from "./ContactDetailsCard";
import { RequestActivityCard } from "./RequestActivityCard";
import type { LucideIcon } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useUserRoles } from "../hooks/useUserRoles";
import { useCarrierApplication } from "@/features/app/carrier/hooks/useCarrier";
import { PageLoader } from "@/components/ui/page-loader";
import { PageWrapper } from "@/components/ui/page-wrapper";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";

export function Profile() {
  const {
    user,
    handleLogout,
    isUploadingImage,
    uploadProfilePicture,
    removeProfilePicture,
    isLoading,
  } = useProfile();

  const { data: userRoles, isLoading: isRolesLoading } = useUserRoles();
  const { user: authUser } = useAuth();

  const t = useTranslations("profile");
  const pathname = usePathname();
  const isDriverRole =
    userRoles?.includes("carrier") || userRoles?.includes("driver") || false;
  // An applicant whose file is in review has a driver section too; someone with
  // no application and no driver role does not (client feedback 2026-11-06, U04).
  const { data: application } = useCarrierApplication({ enabled: !isDriverRole });
  const groups = quickLinkGroups({
    roles: userRoles,
    pathname,
    hasApplication: Boolean(application),
  });

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

  if (!mounted || isLoading || isRolesLoading) {
    return <PageLoader />;
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

      {/* Profile Header — « Identité » */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("sections.identity")}
      </h2>
      <Card className="mb-8">
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
              {userRoles?.includes("admin") && (
                <Badge
                  variant="outline"
                  className="mb-2 gap-1 border-destructive/30 bg-destructive/15 text-destructive"
                >
                  {t("header.adminAccess")}
                </Badge>
              )}
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

      {/* Five headings, in the order someone looks for things: who you are, how
          to reach you, where you are, what you drive, and your account
          (client feedback 2026-11-06, U04). The header card above is « Identité ». */}
      <div className="space-y-8">
        <ProfileSection title={t("sections.contact")}>
          <ContactDetailsCard />
        </ProfileSection>

        <ProfileSection title={t("sections.addresses")}>
          <SavedAddressesCard />
        </ProfileSection>

        {groups.driver.length > 0 && (
          <ProfileSection title={t("sections.driver")}>
            <Card>
              <CardContent className="space-y-2 p-4">
                <QuickLinks links={groups.driver} />
              </CardContent>
            </Card>
          </ProfileSection>
        )}

        <ProfileSection title={t("sections.account")}>
          {authUser?.id ? <RequestActivityCard userId={authUser.id} /> : null}

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

          {groups.account.length > 0 && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <QuickLinks links={groups.account} />
              </CardContent>
            </Card>
          )}

          {/* A "Configuration des virements" card used to sit here, telling
              every user — drivers or not — to connect a Stripe account to be
              paid "for items you sell or deliveries you make". Goods-marketplace
              copy, and untrue: drivers are paid through Mes gains, and the
              Connect account it opened is paid into by nothing. The routes
              behind it are kept (payout_safety_spec.md §5). */}
        </ProfileSection>
      </div>
    </PageWrapper>
  );
}

type QuickLink = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** The general profile tags its links so the page behind can offer « back ». */
  fromProfile?: boolean;
};

// /my-auctions, /my-bids and /earnings used to live here. None of the three
// routes ever existed, so every user was shown three links that 404 — they were
// v1 goods-marketplace leftovers. Bids now live at /carrier/offers, which the
// nav already carries.
const ACCOUNT_LINKS: QuickLink[] = [
  { href: "/profile/reviews", labelKey: "myReviews", icon: Star },
  { href: "/profile/payment-methods", labelKey: "paymentMethods", icon: CreditCard },
  // /profile/invoices existed but was linked from nowhere except an email
  // body, so the only way in was to know the URL.
  { href: "/profile/invoices", labelKey: "myInvoices", icon: Receipt },
  { href: "/help", labelKey: "contactHelp", icon: HelpCircle },
];

/**
 * Which links go under « Chauffeur » and which under « Compte », for this
 * page and this person. Pure, so the page can ask whether a section exists
 * before it draws its heading.
 */
export function quickLinkGroups({
  roles,
  pathname,
  hasApplication,
}: {
  roles?: string[];
  pathname?: string | null;
  hasApplication: boolean;
}): { driver: QuickLink[]; account: QuickLink[] } {
  const isAdmin = roles?.includes("admin");
  const isCarrier = roles?.includes("carrier");
  const isDriver = isCarrier || roles?.includes("driver");

  // On the Admin profile, only the admin links that are not in the bottom nav.
  if (pathname?.startsWith("/admin") && isAdmin) {
    return {
      driver: [],
      account: [
        { href: "/admin/users", labelKey: "adminUsers", icon: Users },
        { href: "/admin/payments", labelKey: "adminPayments", icon: DollarSign },
        { href: "/admin/support", labelKey: "adminSupport", icon: Headset },
      ],
    };
  }

  // On the Driver profile, only the driver links that are not in the bottom nav.
  if (pathname?.startsWith("/driver") && isDriver) {
    return {
      account: [],
      driver: [
        // Earnings live at « Mes gains »; `/earnings` never existed. A carrier
        // who also drives keeps the link; a driver who is not a carrier is never
        // shown pay.
        ...(isCarrier
          ? [{ href: "/carrier/withdrawals", labelKey: "earnings", icon: TrendingUp }]
          : []),
        { href: "/profile/reviews", labelKey: "myReviews", icon: Star },
        // Trips are added, edited and deleted here (client feedback 2026-11-06, C05).
        { href: "/carrier/trips", labelKey: "myTrips", icon: Route },
        { href: "/driver/help", labelKey: "driverSupport", icon: HelpCircle },
      ],
    };
  }

  const account = ACCOUNT_LINKS.map((link) => ({ ...link, fromProfile: true }));
  if (isAdmin) {
    account.unshift({ href: "/admin/expedion", labelKey: "adminDashboard", icon: Shield, fromProfile: true });
    account.push({ href: "/admin/support", labelKey: "adminSupport", icon: Headset, fromProfile: true });
  }

  const driver: QuickLink[] = [];
  if (isDriver) {
    driver.push(
      { href: "/driver/dashboard", labelKey: "driverDashboard", icon: Truck, fromProfile: true },
      { href: "/carrier/trips", labelKey: "myTrips", icon: Route, fromProfile: true },
      // The driver sidebar only carries « Mon dossier » while the file is not
      // approved; once it is, the application (documents, availability, the way
      // to deregister) is reached from here.
      { href: "/carrier/application", labelKey: "driverApplication", icon: ClipboardList, fromProfile: true }
    );
  } else if (hasApplication) {
    driver.push({ href: "/carrier/application", labelKey: "driverApplication", icon: ClipboardList, fromProfile: true });
  } else {
    // Becoming a driver is the carrier application, which is also the
    // "My application" nav entry; with no application yet it is an account link.
    account.push({ href: "/carrier/application", labelKey: "becomeDriver", icon: Truck, fromProfile: true });
  }

  return { driver, account };
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function QuickLinks({ links }: { links: QuickLink[] }) {
  const t = useTranslations("profile.quickLinks");

  return (
    <>
      {links.map((link) => (
        <Link key={link.href} href={link.fromProfile ? `${link.href}?from=profile` : link.href}>
          <Button variant="ghost" className="w-full justify-start gap-3 h-12 group">
            <link.icon className="w-5 h-5 text-primary group-hover:text-accent-foreground" />
            <span>{t(link.labelKey)}</span>
          </Button>
        </Link>
      ))}
      {/* « J'ai une demande » used to be a link of its own here. The client
          asked for it under « Contact & Aide » (client_feedback_2026_10_spec.md
          §6), so it is a card on /help now — the page that link opens. */}
    </>
  );
}
