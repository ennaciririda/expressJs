import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { SECRET_KEY, REFRESH_SECRET_KEY } from '../config.js';
const prisma = new PrismaClient();

const clearAuthCookies = (res) => {
    res.clearCookie('accessToken', {
        httpOnly: true,
    });
    res.clearCookie('refreshToken', {
        httpOnly: true,
    });
};

export const createPresident = async (req, res) => {
    try {
        const cin = '1'
        const name = 'rida'
        const password = '1'
        const email = 'ennaciririda@gmail.com'

        const existingMember = await prisma.member.findUnique({
            where: { cin: cin },
        });
        if (existingMember) {
            return res.status(400).json({ message: 'A member with this CIN already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newMember = await prisma.member.create({
            data: {
                cin: cin,
                name: name,
                email: email,
                password: hashedPassword,
                role: "PRESIDENT",
                committeeId: null,
            },
        });
        return res.status(201).json({ message: 'تم إنشاء الرئيس بنجاح' });
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ error: 'فشل في إنشاء الرئيس' });
    }
}


export const signIn = async (req, res) => {
    try {
        const { cin, password } = req.body;

        if (!cin || !password) {
            return res.status(400).json({ message: 'الرجاء ملء جميع الحقول' });
        }

        const member = await prisma.member.findUnique({
            where: { cin: cin },
        });

        if (!member || !(await bcrypt.compare(password, member.password))) {
            return res.status(400).json({ message: 'المعلومات غير صحيحة' });
        }

        const accessToken = jwt.sign({ cin: member.cin }, SECRET_KEY, { expiresIn: '75m' });
        const refreshToken = jwt.sign({ cin: member.cin }, REFRESH_SECRET_KEY, { expiresIn: '7d' });
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            maxAge: 75 * 60 * 1000,
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.status(200).json({ message: 'تم تسجيل الدخول بنجاح', userData: member });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'فشل في تسجيل الدخول' });
    }
}

export const verifyToken = async (req, res) => {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        clearAuthCookies(res);
        return res.status(401).json({ message: 'Refresh token is missing. Please log in.' });
    }
    try {
        const decodedRefresh = jwt.verify(refreshToken, REFRESH_SECRET_KEY);
        if (accessToken) {
            try {
                const decodedAccess = jwt.verify(accessToken, SECRET_KEY);
                const member = await prisma.member.findUnique({
                    where: { cin: decodedAccess.cin },
                });
                if (!member) {
                    clearAuthCookies(res);
                    return res.status(401).json({ message: 'Invalid access token. Please log in.' });
                }
                return res.status(200).json({ message: 'Valid tokens', member: member });
            } catch (accessError) {
                const newAccessToken = jwt.sign({ cin: decodedRefresh.cin }, SECRET_KEY, {
                    expiresIn: '15m',
                });
                res.cookie('accessToken', newAccessToken, { httpOnly: true, maxAge: 75 * 60 * 1000 });
                const member = await prisma.member.findUnique({
                    where: { cin: decodedRefresh.cin },
                });
                if (!member) {
                    clearAuthCookies(res);
                    return res.status(401).json({ message: 'Invalid access token. Please log in.' });
                }
                return res.status(200).json({ message: 'Valid tokens', member: member });
            }
        } else {
            const newAccessToken = jwt.sign({ cin: decodedRefresh.cin }, SECRET_KEY, {
                expiresIn: '15m',
            });
            res.cookie('accessToken', newAccessToken, { httpOnly: true, maxAge: 75 * 60 * 1000 });
            const member = await prisma.member.findUnique({
                where: { cin: decodedRefresh.cin },
            });
            if (!member) {
                clearAuthCookies(res);
                return res.status(401).json({ message: 'Invalid access token. Please log in.' });
            }
            return res.status(200).json({ message: 'Valid tokens', member: member });
        }
    } catch (refreshError) {
        clearAuthCookies(res);
        return res.status(401).json({ message: 'Invalid or expired refresh token. Please log in.' });
    }
}


export const logout = async (req, res) => {
    try {
        clearAuthCookies(res);
        return res.status(200).json({ message: 'تم تسجيل الخروج بنجاح' });
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ message: 'فشل في تسجيل الخروج' });
    }
}