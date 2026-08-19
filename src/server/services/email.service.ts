import { resend, sendViaResend, EMAIL_FROM } from "@/lib/email";
import { SendEmailSchema, type SendEmailInput } from "@/server/dto/email.dto";
import { WelcomeEmail } from "@/server/emails/WelcomeEmail";
import { PaymentReceiptEmail } from "@/server/emails/PaymentReceiptEmail";
import { ShipmentAssignedEmail } from "@/server/emails/ShipmentAssignedEmail";
import { OrderConfirmationEmail } from "@/server/emails/OrderConfirmationEmail";
import { ShipmentUpdateEmail } from "@/server/emails/ShipmentUpdateEmail";
import { render } from "@react-email/components";

export const emailService = {
  /**
   * Send a generic email
   * Handles both production (Resend) and development (Console) modes
   */
  async sendEmail(input: SendEmailInput): Promise<boolean> {
    const validated = SendEmailSchema.parse(input);

    // Development / Mock Mode
    if (!resend) {
      console.log("==========================================");
      console.log("📧 EMAIL MOCK SENT (No API Key provided)");
      console.log(`To: ${validated.to}`);
      console.log(`Subject: ${validated.subject}`);
      console.log("--- HTML Content Preview ---");
      console.log(validated.html?.substring(0, 100) + "...");
      console.log("==========================================");
      return true;
    }

    try {
      const { error } = await sendViaResend({
        from: EMAIL_FROM,
        to: validated.to,
        subject: validated.subject,
        html: validated.html || "",
        text: validated.text,
      });

      if (error) {
        console.error("Resend API Error:", error);
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      // In production, we might want to throw or log to monitoring
      throw error;
    }
  },

  /**
   * Send Welcome Email to new user
   */
  async sendWelcomeEmail(to: string, name: string) {
    const emailHtml = await render(WelcomeEmail({ name }));

    return this.sendEmail({
      to,
      subject: "Welcome to Expeditoo!",
      html: emailHtml,
    });
  },




  /**
   * Send Order Confirmation Email to buyer
   * Called when order is created (before payment)
   */
  async sendOrderConfirmationEmail(
    to: string,
    buyerName: string,
    itemTitle: string,
    itemPrice: number, // in cents
    shippingPrice: number, // in cents
    totalPrice: number, // in cents
    orderId: string,
    deliveryAddress: string
  ) {
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com"}/deliveries/${orderId}`;

    const emailHtml = await render(
      OrderConfirmationEmail({
        buyerName,
        itemTitle,
        itemPrice,
        shippingPrice,
        totalPrice,
        orderId,
        deliveryAddress,
        paymentUrl,
      })
    );

    return this.sendEmail({
      to,
      subject: `📦 Order Confirmed - #${orderId.slice(0, 8)}`,
      html: emailHtml,
    });
  },

  /**
   * Send Payment Receipt Email to buyer
   * Called when buyer confirms payment
   */
  async sendPaymentReceiptEmail(
    to: string,
    buyerName: string,
    itemTitle: string,
    itemPrice: number, // in cents
    shippingPrice: number, // in cents
    totalPrice: number, // in cents
    orderId: string,
    deliveryAddress: string
  ) {
    const emailHtml = await render(
      PaymentReceiptEmail({
        buyerName,
        itemTitle,
        itemPrice,
        shippingPrice,
        totalPrice,
        orderId,
        deliveryAddress,
      })
    );

    return this.sendEmail({
      to,
      subject: `✅ Payment Confirmed - Order #${orderId.slice(0, 8)}`,
      html: emailHtml,
    });
  },


  /**
   * Send Shipment Assigned Email to driver
   * Called when payment is confirmed and driver has shipment
   */
  async sendShipmentAssignedEmail(
    to: string,
    driverName: string,
    itemTitle: string,
    pickupAddress: string,
    deliveryAddress: string,
    shipmentId: string,
    earnings: number // in cents
  ) {
    const emailHtml = await render(
      ShipmentAssignedEmail({
        driverName,
        itemTitle,
        pickupAddress,
        deliveryAddress,
        shipmentId,
        earnings,
      })
    );

    return this.sendEmail({
      to,
      subject: `🚚 New Shipment Assigned - ${itemTitle}`,
      html: emailHtml,
    });
  },

  /**
   * Send Shipment Update Email to buyer
   * Called when shipment status changes
   */
  async sendShipmentUpdateEmail(
    to: string,
    recipientName: string,
    itemTitle: string,
    shipmentId: string,
    status: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "DELAYED",
    options?: {
      statusMessage?: string;
      driverName?: string;
      estimatedDelivery?: string;
      deliveryAddress?: string;
    }
  ) {
    const emailHtml = await render(
      ShipmentUpdateEmail({
        recipientName,
        itemTitle,
        shipmentId,
        status,
        ...options,
      })
    );

    const statusTitles = {
      PICKED_UP: "Package Picked Up",
      IN_TRANSIT: "In Transit",
      DELIVERED: "Delivered",
      DELAYED: "Delivery Delayed",
    };

    return this.sendEmail({
      to,
      subject: `🚚 ${statusTitles[status]} - ${itemTitle}`,
      html: emailHtml,
    });
  },
};
