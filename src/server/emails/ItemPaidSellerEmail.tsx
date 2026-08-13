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

interface ItemPaidSellerEmailProps {
    sellerName: string;
    itemTitle: string;
    salePrice: number; // in cents
    orderId: string;
}

export const ItemPaidSellerEmail = ({
    sellerName,
    itemTitle,
    salePrice,
    orderId,
}: ItemPaidSellerEmailProps) => {
    const formattedPrice = (salePrice / 100).toFixed(2);
    const previewText = `Payment received for "${itemTitle}" - €${formattedPrice}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            💰 <strong>Payment Received!</strong>
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hello {sellerName},
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Great news! The buyer has completed payment for your item.
                        </Text>

                        {/* Sale Summary */}
                        <Section className="bg-[#f0fdf4] rounded-lg p-4 my-4 border border-solid border-[#86efac]">
                            <Text className="text-black text-[16px] font-semibold m-0">
                                {itemTitle}
                            </Text>
                            <Text className="text-[#166534] text-[20px] font-bold m-0 mt-2">
                                €{formattedPrice}
                            </Text>
                            <Text className="text-[#666666] text-[12px] m-0 mt-1">
                                Order #{orderId.slice(0, 8)}
                            </Text>
                        </Section>

                        <Text className="text-black text-[14px] leading-[24px]">
                            <strong>What's next?</strong>
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            A driver has been assigned to pick up your item. Please prepare it for collection.
                            You'll be notified when the driver is on their way.
                        </Text>

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                href={`${process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com"}/deliveries`}
                                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                            >
                                View Order Details
                            </Link>
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Funds will be transferred to your account once the buyer confirms delivery.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default ItemPaidSellerEmail;
