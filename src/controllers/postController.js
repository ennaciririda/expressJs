// src/controllers/postController.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs"; // Added missing import for fs
import { generateImageUrl, isValidCIN } from "../utils/index.js";

// DONE: Add validation for the post data
export const createPost = async (req, res) => {
  try {
    const { title, content, authorId } = req.body;
    if (
      !title ||
      !content ||
      !authorId ||
      !authorId.trim() ||
      !title.trim() ||
      !content.trim() ||
      !isValidCIN(authorId)
    ) {
      return res.status(400).json({
        error: "يرجى تقديم العنوان والمحتوى ومعرف المؤلف",
      });
    }

    const member = await prisma.member.findUnique({
      where: { cin: authorId },
    });

    if (!member) {
      return res.status(404).json({ error: "لم يتم العثور على العضو" });
    }

    if (member.role !== "PRESIDENT" && member.role !== "COMMITTEE_HEAD") {
      return res
        .status(403)
        .json({ error: "يمكن للرؤساء ورؤساء اللجان فقط إنشاء المنشورات" });
    }

    // Process images
    const imageUrls =
      req.files?.map((file) => ({
        url: `uploads/${file.filename}`,
        fullUrl: generateImageUrl(req, `uploads/${file.filename}`),
      })) || [];

    // Create post
    const newPost = await prisma.post.create({
      data: {
        title,
        content,
        authorId,
        images: {
          create: imageUrls,
        },
      },
      include: {
        images: true,
      },
    });

    const postWithFullUrls = {
      ...newPost,
      images: newPost.images.map((image) => ({
        ...image,
        fullUrl: generateImageUrl(req, image.url),
      })),
    };

    res.status(201).json(postWithFullUrls);
  } catch (error) {
    console.error("خطأ في إنشاء المنشور:", error);
    res.status(500).json({ error: "فشل في إنشاء المنشور" });
  }
};
// DONE: Add deletePost controller
export const deletePost = async (req, res) => {
  
  try {
    const postId = parseInt(req.params.id);
    if (!postId || isNaN(postId)) {
      return res.status(400).json({ error: "معرف المنشور مطلوب" });
    }

    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      include: { images: true },
    });

    if (!existingPost) {
      return res.status(404).json({ error: "لم يتم العثور على المنشور" });
    }

    // Check if the member is a president
    const member = await prisma.member.findUnique({
      where: { cin: existingPost.authorId },
    });

    if (
      !member ||
      (member.role !== "PRESIDENT" && member.role !== "COMMITTEE_HEAD")
    ) {
      return res.status(403).json({ error: "يمكن للرؤساء فقط حذف المنشورات" });
    }

    // Delete images from uploads folder
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    for (const image of existingPost.images) {
      const filename = image.url;
      const filePath = path.join(__dirname, "..", "..", "uploads", filename);
      console.log("جاري حذف الملف:", filePath);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`خطأ في حذف الملف ${filename}:`, error);
      }
    }
    await prisma.post.delete({
      where: { id: postId },
    });

    res.json({ message: "تم حذف المنشور بنجاح" });
  } catch (error) {
    console.error("خطأ في حذف المنشور:", error);
    res.status(500).json({ error: "فشل في حذف المنشور" });
  }
};
// DONE: Add getAllPosts controller
export const getAllPosts = async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        images: true,
      },
    });
    const postsWithFullUrls = posts.map((post) => ({
      ...post,
      images: post.images.map((image) => ({
        ...image,
        fullUrl: generateImageUrl(req, image.url),
      })),
    }));
    res.json(postsWithFullUrls);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "فشل في جلب المنشورات" });
  }
};
// DONE: Add getPostById controller
export const getPostById = async (req, res) => {
  console.log("الحصول على منشور بواسطة المعرف:", req);

  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "معرف المنشور مطلوب" });
    }
    const post = await prisma.post.findUnique({
      where: { id: parseInt(id) },
      include: {
        images: true,
      },
    });
    if (!post) {
      return res.status(404).json({ error: "لم يتم العثور على المنشور" });
    }
    const postWithFullUrls = {
      ...post,
      date: new Date(post.createdAt).toLocaleDateString("en-GB"),
      images: post.images.map((image) => ({
        ...image,
        fullUrl: generateImageUrl(req, image.url),
      })),
    };
    res.json(postWithFullUrls);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "فشل في جلب المنشور" });
  }
};
// DONE: Add editPost controller
export const editPost = async (req, res) => {
  
  try {
    const postId = parseInt(req.params.id);
    if (!postId || isNaN(postId)) {
      return res.status(400).json({ error: "معرف المنشور مطلوب" });
    }
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      include: { images: true },
    });

    if (!existingPost) {
      return res.status(404).json({ error: "لم يتم العثور على المنشور" });
    }

    const { title, content } = req.body;
    const existingImages = req.body.existingImages
      ? Array.isArray(req.body.existingImages)
        ? req.body.existingImages
        : [req.body.existingImages]
      : [];

    // Validate input
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: "العنوان والمحتوى مطلوبان" });
    }

    // Process new images from the request
    const newImageUrls =
      req.files?.map((file) => ({
        url: `uploads/${file.filename}`,
        fullUrl: generateImageUrl(req, `uploads/${file.filename}`),
      })) || [];

    // Get existing image records that should be kept
    const existingImageRecords = existingPost.images.filter((img) =>
      existingImages.includes(img.fullUrl)
    );

    // Delete images that are no longer needed
    const imagesToDelete = existingPost.images.filter(
      (img) => !existingImages.includes(img.fullUrl)
    );

    // Delete files from uploads folder
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    for (const image of imagesToDelete) {
      const filename = image.url;
      const filePath = path.join(__dirname, "..", "..", "uploads", filename);
      console.log("جاري حذف الملف:", filePath);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`خطأ في حذف الملف ${filename}:`, error);
      }
    }

    // Update post in database
    const updatedPost = await prisma.$transaction(async (prisma) => {
      // Delete removed images from database
      await prisma.image.deleteMany({
        where: {
          id: {
            in: imagesToDelete.map((img) => img.id),
          },
        },
      });

      // Update post with new data
      const updated = await prisma.post.update({
        where: { id: postId },
        data: {
          title,
          content,
          updatedAt: new Date(),
          images: {
            create: newImageUrls,
          },
        },
        include: {
          images: true,
        },
      });

      return updated;
    });

    // Add fullUrl to each image in the response
    const postWithFullUrls = {
      ...updatedPost,
      images: updatedPost.images.map((image) => ({
        ...image,
        fullUrl: generateImageUrl(req, image.url),
      })),
    };

    res.json(postWithFullUrls);
  } catch (error) {
    console.error("خطأ في تعديل المنشور:", error);
    res.status(500).json({ error: "فشل في تحديث المنشور" });
  }
};
