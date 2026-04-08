import { useEffect, useState } from "react";
import { useSetPageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Key, Loader2, Save, Settings2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationPreferences {
  email: boolean;
  renewalReminders: boolean;
  claimsAlerts: boolean;
  newClients: boolean;
}

interface ApiConfig {
  whatsappPhoneId: string;
  emailSmtpHost: string;
  emailSmtpUser: string;
}

const defaultNotificationPreferences: NotificationPreferences = {
  email: true,
  renewalReminders: true,
  claimsAlerts: false,
  newClients: true,
};

const defaultClientTemplate =
  "Your insurance policy with {{insurerName}} is expiring in {{days}} days. Please contact your agent to renew.";
const defaultIntermediaryTemplate =
  "Your client {{clientName}}'s policy {{policyNumber}} is expiring in {{days}} days. Please follow up for renewal.";

const parseNotificationPreferences = (rawValue: Json | null): NotificationPreferences => {
  if (!rawValue || Array.isArray(rawValue) || typeof rawValue !== "object") {
    return defaultNotificationPreferences;
  }

  const prefs = rawValue as Record<string, unknown>;
  return {
    email:
      typeof prefs.email === "boolean"
        ? prefs.email
        : defaultNotificationPreferences.email,
    renewalReminders:
      typeof prefs.renewalReminders === "boolean"
        ? prefs.renewalReminders
        : defaultNotificationPreferences.renewalReminders,
    claimsAlerts:
      typeof prefs.claimsAlerts === "boolean"
        ? prefs.claimsAlerts
        : defaultNotificationPreferences.claimsAlerts,
    newClients:
      typeof prefs.newClients === "boolean"
        ? prefs.newClients
        : defaultNotificationPreferences.newClients,
  };
};

const splitName = (fullName: string) => {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...rest] = parts;
  return {
    firstName,
    lastName: rest.join(" "),
  };
};

const SettingsPage = () => {
  const { user, role } = useAuth();
  const isAdmin = role === "super_admin";

  const [profileId, setProfileId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);

  const [newPassword, setNewPassword] = useState("");

  const [organizationId, setOrganizationId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("");
  const [emailSmtpHost, setEmailSmtpHost] = useState("");
  const [emailSmtpUser, setEmailSmtpUser] = useState("");

  const [renewalConfigId, setRenewalConfigId] = useState("");
  const [isRenewalActive, setIsRenewalActive] = useState(true);
  const [reminderWindows, setReminderWindows] = useState<string[]>(["60", "30", "15", "7"]);
  const [renewalCron, setRenewalCron] = useState("0 8 * * *");
  const [clientTemplate, setClientTemplate] = useState(defaultClientTemplate);
  const [intermediaryTemplate, setIntermediaryTemplate] = useState(defaultIntermediaryTemplate);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [savingRenewalConfig, setSavingRenewalConfig] = useState(false);

  useSetPageTitle("Settings");

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone, notification_preferences")
          .eq("user_id", user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        const parsedName = splitName(profile.full_name || "");
        setProfileId(profile.id);
        setFirstName(parsedName.firstName);
        setLastName(parsedName.lastName);
        setEmail(profile.email || user.email || "");
        setPhone(profile.phone || "");
        setNotificationPreferences(parseNotificationPreferences(profile.notification_preferences));

        if (isAdmin) {
          const { data: orgData, error: orgError } = await supabase
            .from("organizations")
            .select("id, company_name, address, city, state, pincode, gst_number, api_config")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (orgError) {
            throw orgError;
          }

          if (orgData) {
            setOrganizationId(orgData.id);
            setCompanyName(orgData.company_name || "");
            setAddress(orgData.address || "");
            setCity(orgData.city || "");
            setStateName(orgData.state || "");
            setPincode(orgData.pincode || "");
            setGstNumber(orgData.gst_number || "");

            const rawApiConfig = orgData.api_config;
            if (rawApiConfig && !Array.isArray(rawApiConfig) && typeof rawApiConfig === "object") {
              const apiConfig = rawApiConfig as Record<string, unknown>;
              setWhatsappPhoneId(typeof apiConfig.whatsappPhoneId === "string" ? apiConfig.whatsappPhoneId : "");
              setEmailSmtpHost(typeof apiConfig.emailSmtpHost === "string" ? apiConfig.emailSmtpHost : "");
              setEmailSmtpUser(typeof apiConfig.emailSmtpUser === "string" ? apiConfig.emailSmtpUser : "");
            }
          }

          const { data: renewalData, error: renewalError } = await supabase
            .from("renewal_config")
            .select("id, enabled, reminder_windows, cron_schedule, client_email_template, intermediary_email_template")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (renewalError) {
            throw renewalError;
          }

          if (renewalData) {
            setRenewalConfigId(renewalData.id);
            setIsRenewalActive(renewalData.enabled);
            setRenewalCron(renewalData.cron_schedule || "0 8 * * *");
            setClientTemplate(renewalData.client_email_template || defaultClientTemplate);
            setIntermediaryTemplate(
              renewalData.intermediary_email_template || defaultIntermediaryTemplate,
            );

            const windows = renewalData.reminder_windows
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 4);

            if (windows.length > 0) {
              const padded = [...windows];
              while (padded.length < 4) {
                padded.push("");
              }
              setReminderWindows(padded);
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load settings";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [isAdmin, user]);

  const handleSaveProfile = async () => {
    if (!profileId || !user) {
      toast.error("Profile data is not ready yet");
      return;
    }

    setSavingProfile(true);
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      const trimmedEmail = email.trim();

      if (!fullName) {
        throw new Error("Name cannot be empty");
      }

      if (!trimmedEmail) {
        throw new Error("Email cannot be empty");
      }

      if (trimmedEmail !== (user.email || "")) {
        const { error: emailUpdateError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (emailUpdateError) {
          throw emailUpdateError;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          email: trimmedEmail,
          phone: phone.trim() || null,
          notification_preferences: notificationPreferences as unknown as Json,
        })
        .eq("id", profileId);

      if (error) {
        throw error;
      }

      toast.success("Profile information updated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw error;
      }

      toast.success("Password updated successfully");
      setNewPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update password";
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleNotificationToggle = async (
    key: keyof NotificationPreferences,
    value: boolean,
  ) => {
    if (!profileId) {
      return;
    }

    const previous = notificationPreferences;
    const nextPreferences = {
      ...notificationPreferences,
      [key]: value,
    };

    setNotificationPreferences(nextPreferences);
    setSavingNotifications(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: nextPreferences as unknown as Json })
        .eq("id", profileId);

      if (error) {
        throw error;
      }
    } catch (error) {
      setNotificationPreferences(previous);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update notification preferences";
      toast.error(message);
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleSaveOrganization = async () => {
    if (!isAdmin || !user) {
      return;
    }

    setSavingOrganization(true);
    try {
      const apiConfig: ApiConfig = {
        whatsappPhoneId: whatsappPhoneId.trim(),
        emailSmtpHost: emailSmtpHost.trim(),
        emailSmtpUser: emailSmtpUser.trim(),
      };
      const hasApiConfig = Object.values(apiConfig).some(Boolean);

      const payload = {
        company_name: companyName.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        state: stateName.trim() || null,
        pincode: pincode.trim() || null,
        gst_number: gstNumber.trim() || null,
        api_config: hasApiConfig ? (apiConfig as unknown as Json) : null,
        updated_by: user.id,
      };

      if (organizationId) {
        const { error } = await supabase
          .from("organizations")
          .update(payload)
          .eq("id", organizationId);

        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await supabase
          .from("organizations")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        setOrganizationId(data.id);
      }

      toast.success("Organization settings updated successfully");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update organization settings";
      toast.error(message);
    } finally {
      setSavingOrganization(false);
    }
  };

  const handleReminderWindowChange = (index: number, value: string) => {
    const next = [...reminderWindows];
    next[index] = value.replace(/[^0-9]/g, "");
    setReminderWindows(next);
  };

  const handleSaveRenewalConfig = async () => {
    if (!isAdmin || !user) {
      return;
    }

    const parsedWindows = reminderWindows
      .map((item) => Number.parseInt(item, 10))
      .filter((item) => Number.isFinite(item) && item > 0);

    if (parsedWindows.length === 0) {
      toast.error("Add at least one valid reminder window");
      return;
    }

    setSavingRenewalConfig(true);
    try {
      const payload = {
        enabled: isRenewalActive,
        reminder_windows: parsedWindows.join(", "),
        cron_schedule: renewalCron.trim() || "0 8 * * *",
        client_email_template: clientTemplate.trim() || defaultClientTemplate,
        intermediary_email_template:
          intermediaryTemplate.trim() || defaultIntermediaryTemplate,
        updated_by: user.id,
      };

      if (renewalConfigId) {
        const { error } = await supabase
          .from("renewal_config")
          .update(payload)
          .eq("id", renewalConfigId);

        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await supabase
          .from("renewal_config")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        setRenewalConfigId(data.id);
      }

      toast.success("Renewal configuration updated successfully");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update renewal configuration";
      toast.error(message);
    } finally {
      setSavingRenewalConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account, organization, and renewal automation preferences
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList
          className={`grid h-auto w-full gap-2 rounded-lg bg-muted p-1 md:inline-flex md:w-auto ${
            isAdmin ? "grid-cols-3" : "grid-cols-1"
          }`}
        >
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" /> Account
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" /> Organization
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="renewal" className="gap-2">
              <Settings2 className="h-4 w-4" /> Renewal Configuration
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="account" className="mt-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+91XXXXXXXXXX"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
                      {savingProfile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    Change Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex max-w-sm items-end gap-3">
                    <div className="flex-1 space-y-2">
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        placeholder="Min 6 characters"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleChangePassword}
                      disabled={savingPassword || !newPassword}
                    >
                      {savingPassword ? "Updating..." : "Update"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="h-fit border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">General system and account emails</p>
                  </div>
                  <Switch
                    checked={notificationPreferences.email}
                    disabled={savingNotifications}
                    onCheckedChange={(checked) =>
                      handleNotificationToggle("email", checked)
                    }
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Renewal Reminders</p>
                    <p className="text-xs text-muted-foreground">Alerts for policies nearing expiry</p>
                  </div>
                  <Switch
                    checked={notificationPreferences.renewalReminders}
                    disabled={savingNotifications}
                    onCheckedChange={(checked) =>
                      handleNotificationToggle("renewalReminders", checked)
                    }
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Claims Alerts</p>
                    <p className="text-xs text-muted-foreground">Claim progress and action updates</p>
                  </div>
                  <Switch
                    checked={notificationPreferences.claimsAlerts}
                    disabled={savingNotifications}
                    onCheckedChange={(checked) =>
                      handleNotificationToggle("claimsAlerts", checked)
                    }
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">New Clients</p>
                    <p className="text-xs text-muted-foreground">New client onboarding activity</p>
                  </div>
                  <Switch
                    checked={notificationPreferences.newClients}
                    disabled={savingNotifications}
                    onCheckedChange={(checked) =>
                      handleNotificationToggle("newClients", checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="organization" className="mt-0">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Organization Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      placeholder="Risk Marshal Pvt Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GST Number</Label>
                    <Input
                      value={gstNumber}
                      onChange={(event) => setGstNumber(event.target.value)}
                      placeholder="29ABCDE1234F1Z5"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Street, area, landmark"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="Bengaluru"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={stateName}
                      onChange={(event) => setStateName(event.target.value)}
                      placeholder="Karnataka"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pincode</Label>
                    <Input
                      value={pincode}
                      onChange={(event) => setPincode(event.target.value)}
                      placeholder="560001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>WhatsApp Phone ID</Label>
                    <Input
                      value={whatsappPhoneId}
                      onChange={(event) => setWhatsappPhoneId(event.target.value)}
                      placeholder="WhatsApp sender identifier"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Host</Label>
                    <Input
                      value={emailSmtpHost}
                      onChange={(event) => setEmailSmtpHost(event.target.value)}
                      placeholder="smtp.mailserver.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP User</Label>
                    <Input
                      value={emailSmtpUser}
                      onChange={(event) => setEmailSmtpUser(event.target.value)}
                      placeholder="noreply@company.com"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveOrganization}
                    disabled={savingOrganization}
                    className="gap-2"
                  >
                    {savingOrganization ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Organization
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="renewal" className="mt-0 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-foreground">Renewal Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Configure automated renewal reminder windows and email templates
                </p>
              </div>
              <Button
                onClick={handleSaveRenewalConfig}
                disabled={savingRenewalConfig}
                className="gap-2"
              >
                {savingRenewalConfig ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Scheduler Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">
                      Renewal reminders are being sent automatically
                    </p>
                  </div>
                  <Switch checked={isRenewalActive} onCheckedChange={setIsRenewalActive} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Reminder Windows</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Set the number of days before policy expiry to send reminders.
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {reminderWindows.map((value, index) => (
                    <div className="space-y-1" key={index}>
                      <Label className="text-xs text-muted-foreground">Window {index + 1} (days)</Label>
                      <Input
                        inputMode="numeric"
                        value={value}
                        onChange={(event) =>
                          handleReminderWindowChange(index, event.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Default: 60, 30, 15, 7 days before expiry. Windows are sorted and deduplicated while saving.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Cron Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label>Cron Expression</Label>
                <Input
                  value={renewalCron}
                  onChange={(event) => setRenewalCron(event.target.value)}
                  placeholder="0 8 * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Default: 0 8 * * * runs daily at 8:00 AM.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Email Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Client Email Template</Label>
                  <p className="text-xs text-muted-foreground">
                    {"Available variables: {{clientName}}, {{policyNumber}}, {{daysLeft}}, {{expiryDate}}, {{insurer}}"}
                  </p>
                  <Textarea
                    rows={4}
                    value={clientTemplate}
                    onChange={(event) => setClientTemplate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Intermediary Email Template</Label>
                  <p className="text-xs text-muted-foreground">
                    {"Available variables: {{intermediaryName}}, {{clientName}}, {{policyNumber}}, {{daysLeft}}, {{expiryDate}}"}
                  </p>
                  <Textarea
                    rows={4}
                    value={intermediaryTemplate}
                    onChange={(event) => setIntermediaryTemplate(event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default SettingsPage;
