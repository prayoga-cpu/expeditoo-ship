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

interface AuctionLostEmailProps {
    bidderName: string;
    itemTitle: string;
    yourHighestBid: number; // in cents
    winningBid: number; // in cents
}

export const AuctionLostEmail = ({
    bidderName,
    itemTitle,
    yourHighestBid,
    winningBid,
}: AuctionLostEmailProps) => {
    const formattedYourBid = (yourHighestBid / 100).toFixed(2);
    const formattedWinningBid = (winningBid / 100).toFixed(2);
    const previewText = `Auction ended - "${itemTitle}"`;
    const browseUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com"}/home`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Auction Ended
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hello {bidderName},
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            The auction you participated in has ended:
                        </Text>
                        <Section className="bg-[#fef2f2] rounded-lg p-4 my-4 border border-[#ef4444]">
                            <Text className="text-black text-[16px] font-semibold m-0">
                                {itemTitle}
                            </Text>
                            <Text className="text-[#666666] text-[14px] m-0 mt-2">
                                Your highest bid: <strong>€{formattedYourBid}</strong>
                            </Text>
                            <Text className="text-[#666666] text-[14px] m-0 mt-1">
                                Winning bid: <strong className="text-[#ef4444]">€{formattedWinningBid}</strong>
                            </Text>
                        </Section>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Unfortunately, you were outbid. But don't worry - there are plenty of
                            other great items waiting for you!
                        </Text>
                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                href={browseUrl}
                                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                            >
                                Browse More Items
                            </Link>
                        </Section>
                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Better luck next time! Keep bidding to win your favorite items.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default AuctionLostEmail;
