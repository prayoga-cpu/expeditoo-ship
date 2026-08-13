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

interface ShipmentAssignedEmailProps {
    driverName: string;
    itemTitle: string;
    pickupAddress: string;
    deliveryAddress: string;
    shipmentId: string;
    earnings: number; // in cents (driver's fee)
}

export const ShipmentAssignedEmail = ({
    driverName,
    itemTitle,
    pickupAddress,
    deliveryAddress,
    shipmentId,
    earnings,
}: ShipmentAssignedEmailProps) => {
    const formattedEarnings = (earnings / 100).toFixed(2);
    const previewText = `New shipment assigned - ${itemTitle}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            🚚 <strong>New Shipment Assigned!</strong>
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hello {driverName},
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Great news! A new shipment has been assigned to you and the buyer has confirmed payment.
                            You can now proceed with the pickup.
                        </Text>

                        {/* Shipment Details */}
                        <Section className="bg-[#f9f9f9] rounded-lg p-4 my-4">
                            <Text className="text-black text-[16px] font-semibold m-0">
                                {itemTitle}
                            </Text>
                            <Text className="text-[#666666] text-[12px] m-0 mt-1">
                                Shipment #{shipmentId.slice(0, 8)}
                            </Text>
                        </Section>

                        {/* Route Info */}
                        <Section className="my-4">
                            <Text className="text-black text-[14px] font-semibold m-0">
                                📍 Pickup from:
                            </Text>
                            <Text className="text-[#666666] text-[13px] m-0 mt-1 mb-4">
                                {pickupAddress}
                            </Text>

                            <Text className="text-black text-[14px] font-semibold m-0">
                                🏠 Deliver to:
                            </Text>
                            <Text className="text-[#666666] text-[13px] m-0 mt-1">
                                {deliveryAddress}
                            </Text>
                        </Section>

                        {/* Earnings */}
                        <Section className="bg-[#f0fdf4] rounded-lg p-4 my-4 border border-solid border-[#86efac]">
                            <Text className="text-[#166534] text-[14px] font-semibold m-0">
                                Your earnings for this delivery:
                            </Text>
                            <Text className="text-[#166534] text-[24px] font-bold m-0 mt-1">
                                €{formattedEarnings}
                            </Text>
                        </Section>

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                href={`${process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com"}/driver/shipments/${shipmentId}`}
                                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                            >
                                View Shipment Details
                            </Link>
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Please pick up the item as soon as possible. Contact the seller if you have any issues
                            with the pickup location.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default ShipmentAssignedEmail;
