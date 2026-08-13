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

interface PaymentReceiptEmailProps {
    buyerName: string;
    itemTitle: string;
    itemPrice: number; // in cents
    shippingPrice: number; // in cents
    totalPrice: number; // in cents
    orderId: string;
    deliveryAddress: string;
}

export const PaymentReceiptEmail = ({
    buyerName,
    itemTitle,
    itemPrice,
    shippingPrice,
    totalPrice,
    orderId,
    deliveryAddress,
}: PaymentReceiptEmailProps) => {
    const formattedItemPrice = (itemPrice / 100).toFixed(2);
    const formattedShippingPrice = (shippingPrice / 100).toFixed(2);
    const formattedTotalPrice = (totalPrice / 100).toFixed(2);
    const previewText = `Payment confirmed for "${itemTitle}" - Receipt`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            ✅ <strong>Payment Confirmed</strong>
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hello {buyerName},
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Thank you for your payment! Your order is now being processed.
                        </Text>

                        {/* Order Summary */}
                        <Section className="bg-[#f9f9f9] rounded-lg p-4 my-4">
                            <Text className="text-black text-[16px] font-semibold m-0">
                                Order #{orderId.slice(0, 8)}
                            </Text>
                            <Hr className="border border-solid border-[#eaeaea] my-3" />
                            <Text className="text-black text-[14px] m-0">
                                {itemTitle}
                            </Text>
                            <Text className="text-[#666666] text-[13px] m-0 mt-1">
                                Item price: €{formattedItemPrice}
                            </Text>
                            <Text className="text-[#666666] text-[13px] m-0 mt-1">
                                Shipping: €{formattedShippingPrice}
                            </Text>
                            <Hr className="border border-solid border-[#eaeaea] my-3" />
                            <Text className="text-black text-[14px] font-semibold m-0">
                                Total: €{formattedTotalPrice}
                            </Text>
                        </Section>

                        {/* Delivery Address */}
                        <Section className="my-4">
                            <Text className="text-black text-[14px] font-semibold m-0">
                                Delivery to:
                            </Text>
                            <Text className="text-[#666666] text-[13px] m-0 mt-1">
                                {deliveryAddress}
                            </Text>
                        </Section>

                        <Text className="text-black text-[14px] leading-[24px]">
                            The driver will pick up your item from the seller and deliver it to you.
                            You'll receive updates as the shipment progresses.
                        </Text>

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                href={`${process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com"}/deliveries`}
                                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                            >
                                Track Your Order
                            </Link>
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            This is your payment receipt. If you have any questions about your order,
                            please contact our support team.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default PaymentReceiptEmail;
