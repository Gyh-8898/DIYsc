import { Image, Input, ScrollView, Text, Textarea, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { api, ComplaintItem } from "../../services/api";
import "./index.scss";

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatStatus(status: string) {
  if (status === "resolved") return "已解决";
  if (status === "rejected") return "已驳回";
  if (status === "processing") return "处理中";
  return "待处理";
}

async function readFileAsBase64(filePath: string): Promise<string> {
  const fsManager = Taro.getFileSystemManager?.();
  if (!fsManager) {
    throw new Error("当前环境不支持读取本地图片");
  }

  return new Promise((resolve, reject) => {
    fsManager.readFile({
      filePath,
      encoding: "base64",
      success: (res) => resolve(String(res.data || "")),
      fail: () => reject(new Error("图片读取失败"))
    });
  });
}

export default function ComplaintPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [list, setList] = useState<ComplaintItem[]>([]);
  const [type, setType] = useState<"complaint" | "appeal">("complaint");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const loadList = async () => {
    if (!api.auth.isLoggedIn()) {
      setList([]);
      return;
    }

    setLoading(true);
    try {
      const rows = await api.complaints.list();
      setList(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadList();
  });

  const handleLogin = async () => {
    try {
      await api.auth.login();
      await loadList();
      Taro.showToast({ title: "登录成功", icon: "success" });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "登录失败", icon: "none" });
    }
  };

  const handleChooseImage = async () => {
    if (images.length >= 3) {
      Taro.showToast({ title: "最多上传3张图片", icon: "none" });
      return;
    }

    try {
      const result = await Taro.chooseImage({
        count: 3 - images.length,
        sizeType: ["compressed"],
        sourceType: ["album", "camera"]
      });
      const files = Array.isArray(result.tempFilePaths) ? result.tempFilePaths : [];
      setImages((prev) => [...prev, ...files].slice(0, 3));
    } catch (_error) {
      // user cancel
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handlePreviewImages = (index: number) => {
    Taro.previewImage({
      current: images[index],
      urls: images
    });
  };

  const uploadSelectedImages = async (): Promise<string[]> => {
    if (!images.length) return [];
    const urls: string[] = [];
    for (const filePath of images) {
      if (/^https?:\/\//.test(filePath)) {
        urls.push(filePath);
        continue;
      }
      const base64 = await readFileAsBase64(filePath);
      const uploaded = await api.upload.imageBase64(`data:image/png;base64,${base64}`);
      urls.push(uploaded.url || uploaded.path);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Taro.showToast({ title: "请填写标题", icon: "none" });
      return;
    }
    if (!content.trim()) {
      Taro.showToast({ title: "请填写详细内容", icon: "none" });
      return;
    }

    setSubmitting(true);
    try {
      const uploadedImages = await uploadSelectedImages();
      await api.complaints.create({
        type,
        title: title.trim(),
        content: content.trim(),
        contact: contact.trim(),
        images: uploadedImages
      });
      setTitle("");
      setContent("");
      setContact("");
      setImages([]);
      Taro.showToast({ title: "提交成功", icon: "success" });
      await loadList();
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "提交失败", icon: "none" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!api.auth.isLoggedIn()) {
    return (
      <View className="complaint-page">
        <View className="complaint-login">
          <View className="complaint-login-card">
            <Text className="complaint-login-title">登录后提交投诉/申诉</Text>
            <Text className="complaint-login-desc">提交后可在本页持续追踪处理状态和回复内容。</Text>
            <View className="complaint-login-btn" onClick={handleLogin}>
              微信登录
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="complaint-page">
      <ScrollView scrollY className="complaint-scroll">
        <View className="complaint-body">
          <View className="complaint-card">
            <Text className="complaint-title">提交工单</Text>
            <View className="complaint-segment">
              <View
                className={`complaint-segment-item ${type === "complaint" ? "active" : ""}`}
                onClick={() => setType("complaint")}
              >
                投诉
              </View>
              <View
                className={`complaint-segment-item ${type === "appeal" ? "active" : ""}`}
                onClick={() => setType("appeal")}
              >
                申诉
              </View>
            </View>

            <Input
              className="complaint-input"
              placeholder="请输入标题（例如：订单物流异常）"
              value={title}
              onInput={(event) => setTitle(event.detail.value)}
            />
            <Textarea
              className="complaint-textarea"
              placeholder="请详细描述问题，便于客服快速处理"
              value={content}
              onInput={(event) => setContent(event.detail.value)}
            />
            <Input
              className="complaint-input"
              placeholder="联系方式（手机号/微信号）"
              value={contact}
              onInput={(event) => setContact(event.detail.value)}
            />

            <View className="complaint-images">
              <View className="complaint-images-head">
                <Text className="complaint-hint">凭证图片（最多3张）</Text>
                <View className="complaint-image-add" onClick={handleChooseImage}>
                  选择图片
                </View>
              </View>
              {images.length > 0 ? (
                <View className="complaint-image-list">
                  {images.map((url, index) => (
                    <View key={`${url}_${index}`} className="complaint-image-item">
                      <Image
                        src={url}
                        className="complaint-image-preview"
                        mode="aspectFill"
                        onClick={() => handlePreviewImages(index)}
                      />
                      <View className="complaint-image-remove" onClick={() => handleRemoveImage(index)}>
                        删除
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <Text className="complaint-hint">说明：提交后可在下方查看处理进度与回复。</Text>
            <View className="complaint-submit-btn" onClick={submitting ? undefined : handleSubmit}>
              {submitting ? "提交中..." : "提交工单"}
            </View>
          </View>

          <View className="complaint-card">
            <Text className="complaint-title">我的工单</Text>
            {list.length === 0 ? (
              <View className="complaint-empty">{loading ? "加载中..." : "暂无工单记录"}</View>
            ) : (
              <View className="complaint-list">
                {list.map((item) => (
                  <View key={item.id} className="complaint-item">
                    <View className="complaint-top">
                      <Text className="complaint-item-title">{item.title}</Text>
                      <Text className={`complaint-tag ${item.status}`}>{formatStatus(item.status)}</Text>
                    </View>
                    <Text className="complaint-item-desc">{item.description}</Text>
                    <Text className="complaint-item-meta">类型：{item.type === "appeal" ? "申诉" : "投诉"}</Text>
                    <Text className="complaint-item-meta">提交时间：{formatDate(item.createdAt)}</Text>
                    {item.contact ? <Text className="complaint-item-meta">联系方式：{item.contact}</Text> : null}

                    {Array.isArray(item.images) && item.images.length > 0 ? (
                      <View className="complaint-history-images">
                        {item.images.map((url, idx) => (
                          <Image key={`${item.id}_${idx}`} src={url} className="complaint-history-image" mode="aspectFill" />
                        ))}
                      </View>
                    ) : null}

                    {Array.isArray(item.replyMessages) && item.replyMessages.length > 0 ? (
                      <View className="complaint-reply">
                        <Text className="complaint-reply-label">平台回复记录</Text>
                        {item.replyMessages.map((msg) => (
                          <View key={msg.id} style={{ marginTop: "8px" }}>
                            <Text className="complaint-item-meta">{formatDate(msg.createdAt)}</Text>
                            <Text className="complaint-reply-content">{msg.content}</Text>
                          </View>
                        ))}
                      </View>
                    ) : item.reply ? (
                      <View className="complaint-reply">
                        <Text className="complaint-reply-label">平台回复</Text>
                        <Text className="complaint-reply-content">{item.reply}</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
