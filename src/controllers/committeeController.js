import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import bcrypt from "bcryptjs";
import { isValidCIN, isValidEmail } from "../utils/index.js";

// DONE: Add validation for the committee data
export const createCommittee = async (req, res) => {
  try {
    const committee = req.body;
    if (committee?.committeeName.trim() === "") {
      res.status(400).json({ error: "اسم اللجنة مطلوب" });
      return;
    }
    if (
      committee?.headData?.name.trim() === "" ||
      committee?.headData?.password.trim() === "" ||
      committee?.headData?.email.trim() === "" ||
      committee?.headData?.cin.trim() === "" ||
      committee?.headData?.role.trim() === "" ||
      committee?.headData?.role !== "COMMITTEE_HEAD" ||
      !isValidCIN(committee?.headData?.cin) ||
      !isValidEmail(committee?.headData?.email)
    ) {
      res.status(400).json({ error: "بيانات رئيس اللجنة غير صالحة" });
      return;
    }
    if (
      committee.members.some(
        (member) =>
          member?.name.trim() === "" ||
          member?.password.trim() === "" ||
          member?.email.trim() === "" ||
          member?.cin.trim() === "" ||
          member?.role.trim() === "" ||
          !isValidCIN(member?.cin) ||
          !isValidEmail(member?.email)
      )
    ) {
      res.status(400).json({ error: "بيانات أحد أعضاء اللجنة غير صالحة" });
      return;
    }
    const headPasswordHashed = await bcrypt.hash(
      committee.headData.password,
      10
    );
    const hashedMembers = await Promise.all(
      committee.members.map(async (member) => ({
        ...member,
        password: await bcrypt.hash(member.password, 10),
      }))
    );
    const newCommittee = await prisma.committee.create({
      data: {
        name: committee.committeeName,
        members: {
          create: [
            // Create committee head
            {
              cin: committee.headData.cin,
              name: committee.headData.name,
              email: committee.headData.email,
              password: headPasswordHashed,
              role: committee.headData.role,
              subscriptionStatus: true, // default for head
            },
            // Create other members
            ...hashedMembers.map((member) => ({
              cin: member.cin,
              name: member.name,
              email: member.email,
              password: member.password,
              role: member.role,
              subscriptionStatus: member.subscriptionStatus === "paid",
              memberType: member.memberType.toUpperCase(),
            })),
          ],
        },
      },
      include: {
        members: true, // Include members in the response
      },
    });
    res.json(newCommittee);
  } catch (error) {
    if (error.code === "P2002" ){
      res.status(400).json({ error: "رقم الهوية أو البريد الإلكتروني موجود بالفعل" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "حدث خطأ ، يرجى المحاولة لاحقاً" });
  }
};
// DONE:
export const getAllCommittees = async (req, res) => {
  try {
    const cin = req.user.cin;
    if (!cin) {
      res.status(401).json({ error: "رقم الهوية مطلوب" });
      return;
    }
    const user = await prisma.member.findUnique({
      where: {
        cin: cin,
      },
    });
    if (!user) {
      res.status(401).json({ error: "العضو غير موجود" });
      return;
    }
    const whereClause = user.committeeId === null ? {} : { id: user.committeeId };
    const committees = await prisma.committee.findMany({
      where: whereClause,
      include: {
        members: true,
      },
    });
    res.status(200).json(committees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ ، يرجى المحاولة لاحقاً" });
  }
};
// DONE: Add validation for the committeeId and projectId
export const getOrphansOfCommittee = async (req, res) => {
  try {
    const { projectId } = req.body;

    const cin = req.user.cin;
    if (!cin) {
      res.status(401).json({ error: "رقم الهوية مطلوب" });
      return;
    }
    const user = await prisma.member.findUnique({
      where: {
        cin: cin,
      },
    });
    if (!user) {
      res.status(401).json({ error: "العضو غير موجود" });
      return;
    }

    const committeeId = user.committeeId;

    if (!committeeId || !projectId) {
      res.status(400).json({ error: "معرف اللجنة ومعرف المشروع مطلوبان" });
      return;
    }
    if (isNaN(committeeId) || isNaN(projectId)) {
      res
        .status(400)
        .json({ error: "معرف اللجنة ومعرف المشروع يجب أن يكون رقمًا" });
      return;
    }
    const orphans = await prisma.child.findMany({
      where: {
        committeeId: committeeId,
      },
      include: {
        projects: {
          where: {
            id: parseInt(projectId),
          },
        },
      },
    });

    // Map the orphans to include join status
    const orphansWithJoinStatus = orphans.map((orphan) => ({
      id: orphan.id,
      name: orphan.fullName,
      joined: orphan.projects.length !== 0,
    }));
    // console.log("orphansWithJoinStatus:", orphansWithJoinStatus);
    res.json(orphansWithJoinStatus);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ ، يرجى المحاولة لاحقاً" });
  }
};
// DONE:
export const getFamiliesOfCommittee = async (req, res) => {
  try {
    const cin = req.user.cin;
    console.log("family cin:", cin);
    if (!cin) {
      res.status(401).json({ error: "رقم الهوية مطلوب" });
      return;
    }
    const user = await prisma.member.findUnique({
      where: {
        cin: cin,
      },
    });

    if (!user) {
      res.status(401).json({ error: "العضو غير موجود" });
      return;
    }
    const committeeId = user.committeeId;
    const families = await prisma.family.findMany({
      where: {
        committeeId: committeeId
      },
      include: {
        projects: {
          where: {
            id: parseInt(req.body.projectId)
          }
        },
        Widow: {
          select: {
            WidowsName: true,
          },
        },
      },
    });
    console.log("families:", families);
    const familiesWithJoinStatus = families.map((family) => ({
      id: family.id,
      name: family.Widow.WidowsName,
      joined: family.projects.length !== 0,
    }));
    // console.log("familiesWithJoinStatus:", familiesWithJoinStatus);
    console.log("families:", familiesWithJoinStatus);
    res.json(familiesWithJoinStatus);
    // res.json(familiesWithJoinStatus);
  } catch (error) {
    console
      .error(error);

    res.status(500).json({ error: "حدث خطأ ، يرجى المحاولة لاحقاً" });
  }
};
// DONE: Add validation for the committeeId
export const addNewMember = async (req, res) => {
  try {
    const { committeeId, member } = req.body;

    console.log("add number:", committeeId, member);
    if (committeeId === "" || isNaN(committeeId)) {
      console.log("error in committee id");
      res.status(400).json({ error: "معرف اللجنة مطلوب" });
      return;
    }
    if (
      member?.name.trim() === "" ||
      member?.password.trim() === "" ||
      member?.email.trim() === "" ||
      member?.cin.trim() === "" ||
      member?.role.trim() === "" ||
      !isValidCIN(member?.cin) ||
      !isValidEmail(member?.email)
    ) {
      console.log("error in member data");
      res.status(400).json({ error: "بيانات العضو غير صالحة" });
      return;
    }
    const hashedPassword = await bcrypt.hash(member.password, 10);

    const newMember = await prisma.member.create({
      data: {
        cin: member.cin,
        name: member.name,
        email: member.email,
        password: hashedPassword,
        role: member.role,
        subscriptionStatus: member.subscriptionStatus === "paid",
        memberType: member.memberType.toUpperCase(),
        committeeId: committeeId,
      },
    });
    res.json(newMember);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ ، يرجى المحاولة لاحقاً" });
  }
};
// DONE: Add validation for the committeeId
// TODO: handle delete cascade for Projects
export const deleteCommittee = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "معرف اللجنة مطلوب" });
      return;
    }
    await prisma.committee.delete({
      where: {
        id: parseInt(id),
      },
    });
    res.json({ message: "Committee deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the committee" });
  }
};
