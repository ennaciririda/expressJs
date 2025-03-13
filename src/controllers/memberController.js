import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import bcrypt from 'bcryptjs';
import { isValidCIN, isValidEmail } from "../utils/index.js";


// DONE: Add validation for the member data
export const editMember = async (req, res) => {

  try {
    const {member} = req.body;
    const { id } = req.params;
    console.log("Member:", id);
    if (
      member?.name.trim() === "" ||
      member?.email.trim() === "" ||
      member?.role.trim() === "" ||
      !isValidEmail(member?.email)
    ) {
      res.status(400).json({ error: 'Invalid member data' });
      return;
    }
    const memberDate = {
      name: member.name,
      email: member.email,
      role: member.role,
      committeeId: member.committeeId,
      memberType: member.memberType,
      subscriptionStatus: member.subscriptionStatus,
    }

    if (member.password) {
      memberDate.password = await bcrypt.hash(member.password, 10);
    }

    const updatedMember = await prisma.member.update({
      where: { cin: id },
      data: memberDate
    });
    res.json(updatedMember);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to edit member' });
  }
}


export const getCommitteeTeachers = async (req, res) => {
  try {
    const { teacherCategory } = req.body;
    const cin = req.user.cin;
    const user = await prisma.member.findUnique({
      where: { cin: cin }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const members = await prisma.member.findMany(
      {
        where: {
          committeeId: user.committeeId,
          memberType: teacherCategory
        },
        select: {
          cin: true,
          name: true,
        }
      }
    )

    const transformedMembers = members.map(member => ({
      id: member.cin,
      name: member.name
    }))

    return res.status(200).json(transformedMembers);

  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get committee members' });
  }
}

// DONE: Add validation for the memberId
export const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidCIN(id)) {
      res.status(400).json({ error: "حدث خطأ ، يرجى المحاولة لاحقاً"});
      return;
    }
    await prisma.member.delete({
      where: { cin: id }
    });
    res.json({ message: 'تم حذف العضو بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ ، يرجى المحاولة لاحقاً"});
  }
}