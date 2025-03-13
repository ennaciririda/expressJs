import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.SECRET_KEY;
const REFRESH_SECRET = process.env.REFRESH_SECRET_KEY;

const clearAuthCookies = (res) => {
    res.clearCookie('accessToken', {
        httpOnly: true,
    });
    res.clearCookie('refreshToken', {
        httpOnly: true,
    });
};

const verifyTokenMiddleWare = (req, res, next) => {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
        clearAuthCookies(res);
        return res.status(401).json({ message: 'Refresh token is missing. Please log in.' });
    }

    try {
        const decodedRefresh = jwt.verify(refreshToken, REFRESH_SECRET);
        if (accessToken) {
            try {
                const decodedAccess = jwt.verify(accessToken, ACCESS_SECRET);
                req.user = { cin: decodedAccess.cin };
                return next();
            } catch (accessError) {
                const newAccessToken = jwt.sign({ cin: decodedRefresh.cin }, ACCESS_SECRET, {
                    expiresIn: '15m',
                });
                res.cookie('accessToken', newAccessToken, { httpOnly: true, maxAge: 75 * 60 * 1000 });
                req.user = { cin: decodedRefresh.cin };
                return next();
            }
        } else {
            const newAccessToken = jwt.sign({ cin: decodedRefresh.cin }, ACCESS_SECRET, {
                expiresIn: '15m',
            });
            res.cookie('accessToken', newAccessToken, { httpOnly: true, maxAge: 75 * 60 * 1000 });
            req.user = { cin: decodedRefresh.cin };
            return next();
        }
    } catch (refreshError) {
        clearAuthCookies(res);
        return res.status(401).json({ message: 'Invalid or expired refresh token. Please log in.' });
    }
};


export default verifyTokenMiddleWare;
