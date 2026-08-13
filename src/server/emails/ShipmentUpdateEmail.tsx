import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Section,
    Text,
    Tailwind,
    Link,
    Hr,
} from "@react-email/components";
import * as React from "react";

type ShipmentStatus =
    | "PICKED_UP"
    | "IN_TRANSIT"
    | "DELIVERED"
    | "DELAYED";

interface ShipmentUpdateEmailProps {
    recipientName: string;
    itemTitle: string;
    shipmentId: string;
    status: ShipmentStatus;
    statusMessage?: string;
    driverName?: string;
    estimatedDelivery?: string;
    deliveryAddress?: string;
}

const statusConfig: Record<ShipmentStatus, { emoji: string; title: string; color: string }> = {
    PICKED_UP: {
        emoji: "📦",
        title: "Package Picked Up",
        color: "#3b82f6", // blue
    },
    IN_TRANSIT: {
        emoji: "🚚",
        title: "In Transit",
        color: "#f59e0b", // amber
    },
    DELIVERED: {
        emoji: "✅",
        title: "Delivered",
        color: "#22c55e", // green
    },
    DELAYED: {
        emoji: "⚠️",
        title: "Delivery Delayed",
        color: "#ef4444", // red
    },
};

export const ShipmentUpdateEmail = ({
    recipientName,
    itemTitle,
    shipmentId,
    status,
    statusMessage,
    driverName,
    estimatedDelivery,
    deliveryAddress,
}: ShipmentUpdateEmailProps) => {
    const config = statusConfig[status];
    const previewText = `Shipment Update: ${itemTitle} - ${config.title}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            {config.emoji} <strong>{config.title}</strong>
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hello {recipientName},
                        </Text>

                        {/* Status Specific Message */}
                        {status === "PICKED_UP" && (
                            <Text className="text-black text-[14px] leading-[24px]">
                                Great news! Your package has been picked up from the seller
                                {driverName ? ` by ${driverName}` : ""} and is on its way to you.
                            </Text>
                        )}
                        {status === "IN_TRANSIT" && (
                            <Text className="text-black text-[14px] leading-[24px]">
                                Your package is currently in transit and on its way to you.
                                {estimatedDelivery ? ` Expected delivery: ${estimatedDelivery}.` : ""}
                            </Text>
                        )}
                        {status === "DELIVERED" && (
                            <Text className="text-black text-[14px] leading-[24px]">
                                Your package has been successfully delivered! We hope you enjoy your purchase.
                            </Text>
                        )}
                        {status === "DELAYED" && (
                            <Text className="text-black text-[14px] leading-[24px]">
                                We're sorry to inform you that your delivery has been delayed.
                                {statusMessage ? ` Reason: ${statusMessage}` : ""} We're working to get it to you as soon as possible.
                            </Text>
                        )}

                        {/* Shipment Info */}
                        <Section className="bg-[#f9f9f9] rounded-lg p-4 my-4">
                            <Text className="text-black text-[16px] font-semibold m-0">
                                Shipment #{shipmentId.slice(0, 8)}
                            </Text>
                            <Hr className="border border-solid border-[#eaeaea] my-3" />
                            <Text className="text-black text-[14px] m-0">
                                {itemTitle}
                            </Text>
                            {driverName && (
                                <Text className="text-[#666666] text-[13px] m-0 mt-1">
                                    Driver: {driverName}
                                </Text>
                            )}
                            {estimatedDelivery && status !== "DELIVERED" && (
                                <Text className="text-[#666666] text-[13px] m-0 mt-1">
                                    Est. delivery: {estimatedDelivery}
                                </Text>
                            )}
                        </Section>

                        {/* Delivery Address (if not delivered) */}
                        {deliveryAddress && status !== "DELIVERED" && (
                            <Section className="my-4">
                                <Text className="text-black text-[14px] font-semibold m-0">
                                    Delivering to:
                                </Text>
                                <Text className="text-[#666666] text-[13px] m-0 mt-1">
                                    {deliveryAddress}
                                </Text>
                            </Section>
                        )}

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                href={`${process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com"}/deliveries/${shipmentId}`}
                                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                            >
                                Track Shipment
                            </Link>
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            If you have any questions about your shipment,
                            please contact our support team or message your driver directly.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default ShipmentUpdateEmail;
