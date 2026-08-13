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

interface AuctionWinEmailProps {
  winnerName: string;
  itemTitle: string;
  winningAmount: number; // in cents
  checkoutUrl: string;
}

export const AuctionWinEmail = ({
  winnerName,
  itemTitle,
  winningAmount,
  checkoutUrl,
}: AuctionWinEmailProps) => {
  const formattedAmount = (winningAmount / 100).toFixed(2);
  const previewText = `Congratulations! You won the auction for "${itemTitle}"`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              🎉 <strong>Congratulations!</strong>
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              Hello {winnerName},
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              Great news! You've won the auction for:
            </Text>
            <Section className="bg-[#f9f9f9] rounded-lg p-4 my-4">
              <Text className="text-black text-[16px] font-semibold m-0">
                {itemTitle}
              </Text>
              <Text className="text-[#666666] text-[14px] m-0 mt-2">
                Winning bid: <strong>€{formattedAmount}</strong>
              </Text>
            </Section>
            <Text className="text-black text-[14px] leading-[24px]">
              To complete your purchase, please provide your delivery address
              and proceed with payment.
            </Text>
            <Section className="text-center mt-[32px] mb-[32px]">
              <Link
                href={checkoutUrl}
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              >
                Complete Checkout
              </Link>
            </Section>
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-[24px]">
              Please complete your checkout as soon as possible. If you have any
              questions, feel free to contact us.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default AuctionWinEmail;
