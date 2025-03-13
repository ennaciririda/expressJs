import express from 'express';
import { upload } from '../config/multer.js';
import { createPost, getAllPosts, getPostById, editPost, deletePost } from '../controllers/postController.js';
import { createCommittee, getAllCommittees, getOrphansOfCommittee, getFamiliesOfCommittee, addNewMember, deleteCommittee } from '../controllers/committeeController.js';
import { createProject, getOrphans, getFamilies, getProjects, getProjectDetails, getBeneficiaries, updateProject, exportProject } from '../controllers/projectController.js';
import { deleteMember, editMember, getCommitteeTeachers } from '../controllers/memberController.js';
import { createPresident, signIn, verifyToken, logout } from '../controllers/authController.js';
import {
  createFamily, updateFamily, getThreeFamilies, getFamilyData, getFamilesOfPage, getFourChildren,
  getChildrenOfPage, searchChildren, getFamilyUpdateData, getChildData, childDataUpdate, updateChild, getAllChildrenData, getAllWidows
} from '../controllers/familyController.js';
import { getStatistics } from '../controllers/dashboardController.js';
import verifyTokenMiddleWare from '../middleware/verifyTokenMiddleWare.js';
import {
  createSubject,
  getAllSubjects,
  updateSubject, getSubjectStudents, getClassData, addRemark, getSubjectRemarks, editClass, getClassAbsence, updateAbsence,
  getSubjectData, createClass,
  getSubjectClasses, deleteRemark, deleteSubject, deleteClass, getExportSubjects
} from '../controllers/subjectsController.js';

const router = express.Router();
import dotenv from 'dotenv';
dotenv.config();

// POST ROUTES
router.post('/create-post', upload.array('images', 5), createPost);
router.get('/posts', getAllPosts);
router.get('/posts/:id', getPostById);
router.put('/update-post/:id', upload.array('images', 5), editPost)
router.delete('/delete-post/:id', deletePost)



// Committee routes
router.post('/create-committee', createCommittee);
router.get('/committees', verifyTokenMiddleWare, getAllCommittees)
router.post('/committee/orphans', verifyTokenMiddleWare, getOrphansOfCommittee)
router.post('/committee/families', verifyTokenMiddleWare, getFamiliesOfCommittee)
router.post('/add-member', addNewMember)
router.delete('/committees/:id', deleteCommittee)


// Member routes
router.post('/edit-member/:id', editMember)
router.post('/get-committee-teachers', verifyTokenMiddleWare, getCommitteeTeachers)
router.delete('/members/:id', deleteMember)

// Projects routes
router.post('/create-project', verifyTokenMiddleWare, createProject)
router.get('/projects', verifyTokenMiddleWare, getProjects)
router.get('/projects/:id', verifyTokenMiddleWare, getProjectDetails)
router.get('/beneficiaries/orphans', verifyTokenMiddleWare, getOrphans)
router.get('/beneficiaries/families', verifyTokenMiddleWare, getFamilies)
router.get('/projects/:id/beneficiaries', verifyTokenMiddleWare, getBeneficiaries)
router.put('/projects/:id', verifyTokenMiddleWare, updateProject);
router.post('/projects/export', verifyTokenMiddleWare, exportProject)

// AUTHENTICATION ROUTES

router.get('/create_president', createPresident);
router.post('/signin', signIn);
router.get('/logout', verifyTokenMiddleWare, logout)
router.get('/verify-tokens', verifyToken)

// END AUTHENTICATION ROUTES



// FAMILY ROUTES

router.post('/create-family', verifyTokenMiddleWare, createFamily);
router.put('/update-family', verifyTokenMiddleWare, updateFamily);
router.get('/get-three-families', verifyTokenMiddleWare, getThreeFamilies);
router.post('/get-family-data', verifyTokenMiddleWare, getFamilyData);
router.post('/get-families-of-page', verifyTokenMiddleWare, getFamilesOfPage);
router.get('/get-four-children', verifyTokenMiddleWare, getFourChildren);
router.post('/get-children-of-page', verifyTokenMiddleWare, getChildrenOfPage)
router.post("/search-children", verifyTokenMiddleWare, searchChildren);
router.post('/get-family-update-data', verifyTokenMiddleWare, getFamilyUpdateData);
router.post('/get-child-data', verifyTokenMiddleWare, getChildData);
router.post('/child-data-update', verifyTokenMiddleWare, childDataUpdate);
router.put('/update-child', verifyTokenMiddleWare, updateChild);

// END FAMILY ROUTES


// SUBJECTS ROUTES

router.post('/get-all-children-data', verifyTokenMiddleWare, getAllChildrenData);
router.post('/create-subject', verifyTokenMiddleWare, createSubject);
router.post('/update-subject', verifyTokenMiddleWare, updateSubject);
router.post('/get-all-subjects', verifyTokenMiddleWare, getAllSubjects);
router.get('/get-all-widows', verifyTokenMiddleWare, getAllWidows);
router.post('/create-class', verifyTokenMiddleWare, createClass);
router.post('/get-subject-data', verifyTokenMiddleWare, getSubjectData);
router.post('/get-subject-students', verifyTokenMiddleWare, getSubjectStudents);
router.post('/get-class-data', verifyTokenMiddleWare, getClassData);
router.post('/add-remark', verifyTokenMiddleWare, addRemark);
router.post('/get-subject-remarks', verifyTokenMiddleWare, getSubjectRemarks);
router.post('/edit-class', verifyTokenMiddleWare, editClass);
router.post('/get-class-absence', verifyTokenMiddleWare, getClassAbsence);
router.post('/update-absence', verifyTokenMiddleWare, updateAbsence);
router.post('/get-subject-classes', verifyTokenMiddleWare, getSubjectClasses);
router.post('/delete-remark', verifyTokenMiddleWare, deleteRemark)
router.post('/delete-subject', verifyTokenMiddleWare, deleteSubject);
router.post('/delete-class', verifyTokenMiddleWare, deleteClass);
router.post('/export-subjects', verifyTokenMiddleWare, getExportSubjects);


// END SUBJECTS ROUTES




// DASHBOARD ROUTES

router.get('/get-statistics', verifyTokenMiddleWare, getStatistics)

// END DASHBOARD ROUTES





export default router;




