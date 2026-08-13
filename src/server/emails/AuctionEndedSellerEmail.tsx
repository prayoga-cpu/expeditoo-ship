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

interface AuctionEndedSellerEmailProps {
    sellerName: string;
    itemTitle: string;
    hasWinner: boolean;
    winnerName?: string;
    winningAmount?: number; // in cents
    listingId: string;
}

export const AuctionEndedSellerEmail = ({
    sellerName,
    itemTitle,
    hasWinner,
    winnerName,
    winningAmount,
    listingId,
}: AuctionEndedSellerEmailProps) => {
    const formattedAmount = winningAmount ? (winningAmount / 100).toFixed(2) : "0.00";
    const previewText = hasWinner
        ? `Your auction "${itemTitle}" has been sold!`
        : `Your auction "${itemTitle}" has ended without bids`;
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com"}/my-auctions`;
    const repostUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com"}/listing/${listingId}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        {hasWinner ? (
                            <>
                                <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                                    🎊 <strong>Your Auction Sold!</strong>
                                </Heading>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    Hello {sellerName},
                                </Text>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    Great news! Your auction has ended with a successful sale:
                                </Text>
                                <Section className="bg-[#f0fdf4] rounded-lg p-4 my-4 border border-[#22c55e]">
                                    <Text className="text-black text-[16px] font-semibold m-0">
                                        {itemTitle}
                                    </Text>
                                    <Text className="text-[#666666] text-[14px] m-0 mt-2">
                                        Sold for: <strong className="text-[#22c55e]">€{formattedAmount}</strong>
                                    </Text>
                                    <Text className="text-[#666666] text-[14px] m-0 mt-1">
                                        Winner: <strong>{winnerName}</strong>
                                    </Text>
                                </Section>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    The buyer will now set their delivery address and a driver will be assigned.
                                    You'll receive funds after successful delivery.
                                </Text>
                            </>
                        ) : (
                            <>
                                <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                                    Auction Ended
                                </Heading>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    Hello {sellerName},
                                </Text>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    Unfortunately, your auction has ended without any bids:
                                </Text>
                                <Section className="bg-[#fef3c7] rounded-lg p-4 my-4 border border-[#f59e0b]">
                                    <Text className="text-black text-[16px] font-semibold m-0">
                                        {itemTitle}
                                    </Text>
                                    <Text className="text-[#666666] text-[14px] m-0 mt-2">
                                        No bids received
                                    </Text>
                                </Section>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    Don't worry! You can repost this item or adjust the starting price
                                    to attract more bidders.
                                </Text>
                                <Section className="text-center mt-[32px] mb-[32px]">
                                    <Link
                                        href={repostUrl}
                                        className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                                    >
                                        Repost Item
                                    </Link>
                                </Section>
                            </>
                        )}
                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                href={dashboardUrl}
                                className="text-[#2563eb] text-[14px] underline"
                            >
                                View My Auctions
                            </Link>
                        </Section>
                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Thank you for selling on Expeditoo!
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default AuctionEndedSellerEmail;
