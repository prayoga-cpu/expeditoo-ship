"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createDriverApplicationSchema,
  CreateDriverApplicationInput,
} from "@/server/dto/driver.dto";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useRouter } from "next/navigation";

const VEHICLE_TYPES = [
  "Car",
  "Utility Van (6-12m³)",
  "Large Van (12-20m³)",
  "Truck (>20m³)",
  "Cargo Bike",
  "Scooter",
];

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Car, Building, FileText, Send } from "lucide-react";

import { submitDriverApplication } from "../api";

// ... previous imports

export function DriverApplicationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<CreateDriverApplicationInput>({
    resolver: zodResolver(createDriverApplicationSchema),
    defaultValues: {
      vehicleType: "",
      vehiclePlate: "",
      licenseNumber: "",
      siret: "",
      companyName: "",
      proposalRate: "",
    },
  });

  async function onSubmit(data: CreateDriverApplicationInput) {
    setIsSubmitting(true);
    try {
      await submitDriverApplication(data);

      toast({
        title: "Application Submitted!",
        description:
          "Your application has been received and is under review by our administrators.",
      });

      router.refresh();
      router.push("/profile"); // Redirect to profile after success ? Or stay. Refresh usually good.
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-10">
        {/* Vehicle Information */}
        <Card className="bg-transparent border-none shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Car className="w-5 h-5 text-primary" />
              Vehicle & License
            </CardTitle>
            <CardDescription>
              Details about your vehicle and driving credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="vehicleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VEHICLE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehiclePlate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Plate</FormLabel>
                  <FormControl>
                    <Input placeholder="AA-123-BB" {...field} />
                  </FormControl>
                  <FormDescription>Standard format</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="licenseNumber"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Driver's License Number</FormLabel>
                  <FormControl>
                    <Input placeholder="123456789012" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card className="bg-transparent border-none shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Building className="w-5 h-5 text-primary" />
              Business Information
            </CardTitle>
            <CardDescription>
              Your professional status and company details.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="siret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SIRET Number</FormLabel>
                  <FormControl>
                    <Input placeholder="14 digits" maxLength={14} {...field} />
                  </FormControl>
                  <FormDescription>Unique business identifier</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Transport Express SAS" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card className="bg-transparent border-none shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileText className="w-5 h-5 text-primary" />
              Proposal
            </CardTitle>
            <CardDescription>
              Tell us about your services or standard rates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="proposalRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Proposal / Note (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="I am available on weekends. My rate is usually..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            size="lg"
            className="w-auto px-8 gap-2 font-semibold mx-6"
          >
            {isSubmitting ? (
              <>
                <LottieLoader width={20} height={20} className="mr-2" />
                Submitting...
              </>
            ) : (
              <>
                Submit Application
                <Send className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
