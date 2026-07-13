import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button, Callout, Flex, Select, Text, TextArea, TextField } from "@radix-ui/themes";
import { inspectLinkMetadata } from "../lib/linkMetadata";
import { getLinkIconUrl, setDefaultLinkIcon } from "../lib/url";
import type { CategoryFormValue, LinkFormValue, NavCategory, NavLink, Profile } from "../types";

const labelClass = "space-y-1.5 text-sm font-medium text-slate-700";

type LinkFormProps = {
  categories: NavCategory[];
  initialValue?: NavLink;
  initialCategoryId?: string;
  onCancel: () => void;
  onSubmit: (value: LinkFormValue) => Promise<void>;
};

export function LinkForm({ categories, initialCategoryId, initialValue, onCancel, onSubmit }: LinkFormProps) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [url, setUrl] = useState(initialValue?.url ?? "");
  const [iconUrl, setIconUrl] = useState(initialValue?.iconUrl ?? "");
  const [iconDataUrl, setIconDataUrl] = useState<string | undefined>(initialValue?.iconDataUrl);
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [categoryId, setCategoryId] = useState(initialValue?.categoryId ?? initialCategoryId ?? categories[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [checked, setChecked] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSubmitError("");
    try {
      await onSubmit({ id: initialValue?.id, title, url, iconUrl, iconDataUrl, description, categoryId });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "保存链接失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleInspect() {
    setChecking(true);
    setCheckError("");
    setChecked(false);

    try {
      const metadata = await inspectLinkMetadata(url);
      setUrl(metadata.url);
      setTitle((current) => current || metadata.title);
      setIconUrl(metadata.iconUrl);
      setIconDataUrl(metadata.iconDataUrl || undefined);
      setChecked(true);
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : "链接检查失败");
    } finally {
      setChecking(false);
    }
  }

  return (
    <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
      <label className={labelClass}>
        地址
        <div className="flex gap-2">
          <TextField.Root
            className="min-w-0 flex-1"
            onChange={(event) => {
              setUrl(event.target.value);
              setChecked(false);
            }}
            placeholder="https://example.com"
            required
            value={url}
          />
          <Button disabled={!url.trim() || checking} onClick={handleInspect} type="button" variant="surface">
            {checking ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            检查
          </Button>
        </div>
      </label>
      {checkError ? (
        <Callout.Root color="red" size="1">
          <Callout.Text>{checkError}</Callout.Text>
        </Callout.Root>
      ) : null}
      {checked ? (
        <Callout.Root color="green" size="1">
          <Callout.Text>已识别标题和网站图标，可继续调整后保存。</Callout.Text>
        </Callout.Root>
      ) : null}
      {submitError ? (
        <Callout.Root color="red" size="1">
          <Callout.Text>{submitError}</Callout.Text>
        </Callout.Root>
      ) : null}
      <label className={labelClass}>
        名称
        <TextField.Root onChange={(event) => setTitle(event.target.value)} required value={title} />
      </label>
      <label className={labelClass}>
        图标
        <div className="flex items-center gap-2">
          <img
            alt=""
            className="h-9 w-9 shrink-0 rounded-md border border-slate-200 bg-slate-50"
            onError={(event) => {
              if (iconDataUrl && event.currentTarget.src !== iconDataUrl) {
                event.currentTarget.src = iconDataUrl;
                return;
              }
              setDefaultLinkIcon(event.currentTarget);
            }}
            src={getLinkIconUrl(url, iconUrl)}
          />
          <TextField.Root
            className="min-w-0 flex-1"
            onChange={(event) => setIconUrl(event.target.value)}
            placeholder="自动识别，必要时可手动修改"
            value={iconUrl}
          />
        </div>
      </label>
      <label className={labelClass}>
        分类
        <Select.Root onValueChange={setCategoryId} value={categoryId}>
          <Select.Trigger className="w-full" />
          <Select.Content>
            {categories.map((category) => (
              <Select.Item key={category.id} value={category.id}>
                {category.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </label>
      <label className={labelClass}>
        描述
        <TextArea
          className="min-h-24"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </label>
      <Flex gap="2" justify="end">
        <Button color="gray" onClick={onCancel} type="button" variant="soft">
          取消
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? <Loader2 className="animate-spin" size={16} /> : null}
          保存
        </Button>
      </Flex>
    </form>
  );
}

type CategoryFormProps = {
  initialValue?: NavCategory;
  onCancel: () => void;
  onSubmit: (value: CategoryFormValue) => Promise<void>;
};

export function CategoryForm({ initialValue, onCancel, onSubmit }: CategoryFormProps) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSubmitError("");
    try {
      await onSubmit({ id: initialValue?.id, name, sortOrder: initialValue?.sortOrder });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "保存分类失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
      <label className={labelClass}>
        分类名称
        <TextField.Root onChange={(event) => setName(event.target.value)} required value={name} />
      </label>
      {submitError ? (
        <Callout.Root color="red" size="1">
          <Callout.Text>{submitError}</Callout.Text>
        </Callout.Root>
      ) : null}
      <Flex gap="2" justify="end">
        <Button color="gray" onClick={onCancel} type="button" variant="soft">
          取消
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? <Loader2 className="animate-spin" size={16} /> : null}
          保存
        </Button>
      </Flex>
    </form>
  );
}

type ProfileFormProps = {
  profile: Profile | null;
  fallbackName: string;
  onCancel: () => void;
  onSubmit: (username: string, passwordHint: string) => Promise<void>;
};

export function ProfileForm({ fallbackName, onCancel, onSubmit, profile }: ProfileFormProps) {
  const [username, setUsername] = useState(profile?.username ?? fallbackName);
  const [passwordHint, setPasswordHint] = useState(profile?.passwordHint ?? "");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSubmitError("");
    try {
      await onSubmit(username, passwordHint);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "保存账号设置失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
      <label className={labelClass}>
        用户名
        <TextField.Root onChange={(event) => setUsername(event.target.value)} required value={username} />
      </label>
      <label className={labelClass}>
        密码提示
        <TextField.Root
          onChange={(event) => setPasswordHint(event.target.value)}
          placeholder="GitHub OAuth 登录，无需在本站保存密码"
          value={passwordHint}
        />
      </label>
      <Text as="p" color="gray" size="2">
        登录由 GitHub OAuth 负责，本站只保存用户名和密码提示，不保存明文密码。
      </Text>
      {submitError ? (
        <Callout.Root color="red" size="1">
          <Callout.Text>{submitError}</Callout.Text>
        </Callout.Root>
      ) : null}
      <Flex gap="2" justify="end">
        <Button color="gray" onClick={onCancel} type="button" variant="soft">
          取消
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? <Loader2 className="animate-spin" size={16} /> : null}
          保存
        </Button>
      </Flex>
    </form>
  );
}
