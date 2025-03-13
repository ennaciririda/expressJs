import { z } from 'zod';

export const isValidCIN = (cin) => {
  const cinRegex = /^[A-Z]{1,2}[0-9]+$/i;
  return cinRegex.test(cin);
};

export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const generateImageUrl = (req, relativePath) => {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/${relativePath}`;
};

const semesterGradeSchema = z.object({
  yearNumber: z.number().int().min(1, "يجب أن يكون رقم السنة 1 على الأقل").max(12, "يجب أن يكون رقم السنة 12 كحد أقصى").positive("يجب أن يكون رقم السنة موجباً"),
  yearLabel: z.enum(["السنة 1 إبتدائي", "السنة 2 إبتدائي", "السنة 3 إبتدائي", "السنة 4 إبتدائي", "السنة 5 إبتدائي", "السنة 6 إبتدائي", "السنة 1 إعدادي", "السنة 2 إعدادي", "السنة 3 إعدادي", "السنة 1 تأهيلي", "السنة 2 تأهيلي", "السنة 3 تأهيلي"], {
    errorMap: () => ({ message: "الرجاء اختيار مستوى دراسي صحيح" })
  }),
  grade: z.string()
    .refine((grade) => !isNaN(parseFloat(grade)), {
      message: "يجب أن تكون الدرجة رقماً"
    })
    .refine((grade) => {
      const numGrade = parseFloat(grade);
      return numGrade >= 0 && numGrade <= 20;
    }, {
      message: "يجب أن تكون الدرجة بين 0 و 20"
    })
}).refine((data) => {
  const numGrade = parseFloat(data.grade);
  const yearNumber = data.yearNumber;

  if (yearNumber >= 1 && yearNumber <= 6) {
    return numGrade <= 10;
  }
  return true;
}, {
  message: "يجب أن تكون الدرجة بين 0 و 10 للمستوى الابتدائي",
  path: ["grade"]
});

const childSchema = z.object({
  id: z.union([
    z.string().startsWith('new_', "معرف غير صالح"),
    z.string().transform((val) => parseInt(val)),
    z.number()
  ]).optional(),
  data: z.object({
    fullName: z.string()
      .min(2, "يجب أن يتكون الاسم الكامل من حرفين على الأقل")
      .max(100, "يجب أن لا يتجاوز الاسم الكامل 100 حرف"),
    dateOfBirth: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "تاريخ الميلاد غير صالح"
    }),
    gender: z.enum(['male', 'female'], {
      errorMap: () => ({ message: "الرجاء اختيار الجنس" })
    }),
    schoolLevel: z.enum(["غير متمدرس", "الأولى إبتدائي", "الثانية إبتدائي", "الثالثة إبتدائي", "الرابعة إبتدائي", "الخامسة إبتدائي", "السادسة إبتدائي", "الأولى ثانوي إعدادي", "الثانية ثانوي إعدادي", "الثالثة ثانوي إعدادي", "الأولى ثانوي تأهيلي", "الثانية ثانوي تأهيلي", "الثالثة ثانوي تأهيلي"], {
      errorMap: () => ({ message: "الرجاء اختيار المستوى الدراسي" })
    }),
    avatar: z.string().optional().nullable(),
    semesterGrades: z.array(semesterGradeSchema, {
      required_error: "الرجاء إدخال درجات الفصل الدراسي",
      invalid_type_error: "تنسيق درجات الفصل الدراسي غير صحيح"
    })
  })
});

export const familyBaseSchema = z.object({
  registrationDate: z.string({
    invalid_type_error: "تاريخ التسجيل يجب أن يكون نصاً"
  }).refine((date) => !isNaN(Date.parse(date)), {
    message: "تاريخ التسجيل غير صالح"
  }),

  OrphansLastName: z.string({
    invalid_type_error: "اسم العائلة يجب أن يكون نصاً"
  })
    .min(2, "يجب أن يتكون اسم العائلة من حرفين على الأقل")
    .max(100, "يجب أن لا يتجاوز اسم العائلة 100 حرف"),

  Housing: z.string({
    invalid_type_error: "معلومات السكن يجب أن تكون نصاً"
  }).min(1, "الرجاء إدخال معلومات السكن"),

  HousingType: z.string({
    invalid_type_error: "نوع السكن يجب أن يكون نصاً"
  }).min(1, "الرجاء تحديد نوع السكن"),

  RentalAmount: z.string().min(1, "الرجاء إدخال قيمة الإيجار"),

  importantNeeds: z.array(z.string({
    invalid_type_error: "الاحتياج يجب أن يكون نصاً"
  }), {
    invalid_type_error: "تنسيق الاحتياجات المهمة غير صحيح"
  }).optional()
    .default([]),
  // Widow related fields
  WidowsName: z.string({
    invalid_type_error: "اسم الأرملة يجب أن يكون نصاً"
  })
    .min(2, "يجب أن يتكون اسم الأرملة من حرفين على الأقل")
    .max(100, "يجب أن لا يتجاوز اسم الأرملة 100 حرف"),

  HealthStatus: z.string({
    invalid_type_error: "الحالة الصحية يجب أن تكون نصاً"
  }).min(1, "الرجاء إدخال الحالة الصحية"),

  AddressOfHeadOfFamily: z.string({
    invalid_type_error: "العنوان يجب أن يكون نصاً"
  }).min(5, "يجب أن يتكون العنوان من 5 أحرف على الأقل"),

  phoneNumber: z.string({
    invalid_type_error: "رقم الهاتف يجب أن يكون نصاً"
  }).regex(/^[0-9]{10}$/, "رقم الهاتف يجب أن يتكون من 10 أرقام"),

  cinNumber: z.string({
    invalid_type_error: "رقم البطاقة الوطنية يجب أن يكون نصاً"
  }).regex(/^[A-Z]{1,2}[0-9]+$/i, "رقم البطاقة الوطنية غير صالح"),

  level: z.enum(["غير متمدرس", "الأولى إبتدائي", "الثانية إبتدائي", "الثالثة إبتدائي", "الرابعة إبتدائي", "الخامسة إبتدائي", "السادسة إبتدائي", "الأولى ثانوي إعدادي", "الثانية ثانوي إعدادي", "الثالثة ثانوي إعدادي", "الأولى ثانوي تأهيلي", "الثانية ثانوي تأهيلي", "الثالثة ثانوي تأهيلي"], {
    errorMap: () => ({ message: "الرجاء اختيار المستوى الدراسي" })
  }),

  diplome: z.string({
    invalid_type_error: "الشهادة يجب أن تكون نصاً"
  }).min(3, "يجب أن تتكون الشهادة من 3 أحرف على الأقل").optional(),

  Job: z.string({
    invalid_type_error: "المسمى الوظيفي يجب أن يكون نصاً"
  }).min(3, "يجب أن يتكون المسمى الوظيفي من 3 أحرف على الأقل"),

  salaire: z.string().min(1, "الرجاء إدخال الراتب"),

  ExtraSalaire: z.string().min(1, "الرجاء إدخال الدخل الإضافي"),

  children: z.array(childSchema, {
    required_error: "الرجاء إدخال معلومات الأطفال",
    invalid_type_error: "تنسيق معلومات الأطفال غير صحيح"
  }).min(1, "يجب إضافة طفل واحد على الأقل")
});

export const createFamilySchema = familyBaseSchema;

export const updateFamilySchema = familyBaseSchema.extend({
  id: z.union([
    z.string().transform((val) => parseInt(val)),
    z.number()
  ]).refine(val => val !== undefined && val !== null, {
    message: "معرف العائلة مطلوب"
  })
});



export const globalChildSchema = z.object({
  id: z.union([
    z.string().transform((val) => parseInt(val)),
    z.number()
  ]),
  data: z.object({
    fullName: z.string()
      .min(2, "يجب أن يتكون الاسم الكامل من حرفين على الأقل")
      .max(100, "يجب أن لا يتجاوز الاسم الكامل 100 حرف"),
    dateOfBirth: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "تاريخ الميلاد غير صالح"
    }),
    gender: z.enum(['male', 'female'], {
      errorMap: () => ({ message: "الرجاء اختيار الجنس" })
    }),
    schoolLevel: z.enum(["غير متمدرس", "الأولى إبتدائي", "الثانية إبتدائي", "الثالثة إبتدائي", "الرابعة إبتدائي", "الخامسة إبتدائي", "السادسة إبتدائي", "الأولى ثانوي إعدادي", "الثانية ثانوي إعدادي", "الثالثة ثانوي إعدادي", "الأولى ثانوي تأهيلي", "الثانية ثانوي تأهيلي", "الثالثة ثانوي تأهيلي"], {
      errorMap: () => ({ message: "الرجاء اختيار المستوى الدراسي" })
    }),
    avatar: z.string().optional().nullable(),
    semesterGrades: z.array(semesterGradeSchema, {
      required_error: "الرجاء إدخال درجات الفصل الدراسي",
      invalid_type_error: "تنسيق درجات الفصل الدراسي غير صحيح"
    })
  })
});


const EducationTarget = z.enum(['ORPHAN', 'WIDOW']);
const StudentSchema = z.object({
  id: z.number(),
  name: z.string()
});


const SubjectSchema = z.object({
  subjectName: z.string()
    .min(4, 'يجب أن يكون اسم المادة أكثر من 5 حروف')
    .max(100, 'يجب أن يكون اسم المادة أقل من 100 حرف'),

  selectedStudents: z.array(StudentSchema)
    .min(1, 'مطلوب تلميذ واحد على الأقل'),

  level: z.string()
    .optional()
    .refine((val) => {
      return true;
    }),

  teacher: z.string().min(1, 'الرجاء إختيار المعلم'),
  target: EducationTarget
}).refine((data) => {
  if (data.target === 'ORPHAN' && !data.level) {
    return false;
  }
  return true;
}, {
  message: "يجب تحديد المستوى الدراسي",
  path: ["level"]
});


export const createSubjectSchema = SubjectSchema;
export const updateSubjectSchema = z.intersection(
  SubjectSchema,
  z.object({
    id: z.union([
      z.string().transform((val) => parseInt(val)),
      z.number()
    ]).refine(val => val !== undefined && val !== null, {
      message: "معرف المادة مطلوب"
    })
  })
);


export const createClassSchema = z.object({
  subjectId: z.string()
    .min(1, "معرف المادة مطلوب")
    .transform((val) => parseInt(val))
    .refine((val) => !isNaN(val), "معرف المادة غير صالح"),

  name: z.string()
    .min(4, "اسم الفصل مطلوب")
    .max(20, "يجب أن يكون اسم الفصل أقل من 20 حرف"),

  date: z.string()
    .refine((date) => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, "Invalid date format. Use YYYY-MM-DD")
    .transform((date) => new Date(date)),

  time: z.string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:mm (24-hour format)")
});


export const updateClassSchema = z.object({
  classId: z.string()
    .min(1, "معرف المادة مطلوب")
    .transform((val) => parseInt(val))
    .refine((val) => !isNaN(val), "معرف المادة غير صالح"),

  name: z.string()
    .min(4, "اسم الفصل مطلوب")
    .max(20, "يجب أن يكون اسم الفصل أقل من 20 حرف"),

  date: z.string()
    .refine((date) => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, "Invalid date format. Use YYYY-MM-DD")
    .transform((date) => new Date(date)),

  time: z.string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:mm (24-hour format)")
});


// ***** REMARKS VALIDATIN FUNCTIONS ***** //


const RemarkSchema = z.object({
  studentId: z.number(),
  subjectId: z.string()
    .min(1, "معرف  مطلوب")
    .transform((val) => parseInt(val))
    .refine((val) => !isNaN(val), "معرف المادة غير صالح"),

  target: EducationTarget
});

export const deleteRemarkSchema = RemarkSchema;
export const addRemarkSchema = RemarkSchema.extend({
  content: z.string()
    .min(4, "الملاحظة مطلوبة")
    .max(100, "يجب أن يكون النص أقل من 100 حرف")
});

// ***** END REMARKS VALIDATIN FUNCTIONS ***** //

// ***** ATTENDANCE VALIDATIN FUNCTIONS ***** //


const studentAttendanceSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Student name is required"),
  isPresent: z.boolean(),
  isJustified: z.boolean()
});

export const attendanceSchema = z.object({
  classId: z.union([
    z.string().transform((val) => parseInt(val)),
    z.number()
  ]),
  students: z.array(studentAttendanceSchema).nonempty("At least one student is required")
});

// ***** END ATTENDANCE VALIDATIN FUNCTIONS ***** //


// ***** PROJECTS VALIDATIN FUNCTIONS ***** //

export const AmountsSchema = z.object({
  committee: z.number({
    required_error: "ميزانية اللجنة مطلوبة",
    invalid_type_error: "يجب أن تكون ميزانية اللجنة رقماً"
  }).positive("يجب أن تكون ميزانية اللجنة رقمًا موجبًا"),

  external: z.number({
    required_error: "ميزانية الجهة الخارجية مطلوبة",
    invalid_type_error: "يجب أن تكون ميزانية الجهة الخارجية رقماً"
  }).positive("يجب أن تكون ميزانية الجهة الخارجية رقمًا موجبًا"),

  total: z.number({
    required_error: "الميزانية الإجمالية مطلوبة",
    invalid_type_error: "يجب أن تكون الميزانية الإجمالية رقماً"
  }).positive("يجب أن تكون الميزانية الإجمالية رقمًا موجبًا")
}).refine((data) => {
  return data.total === data.committee + data.external;
}, {
  message: "يجب أن تكون الميزانية الإجمالية مجموع ميزانيتي اللجنة والجهة الخارجية",
});

const projectSchema = z.object({
  name: z.string().min(4, "يجب أن يحتوي اسم المشروع على 4 أحرف على الأقل"),
  description: z.string().min(5, "يجب أن تحتوي وصف المشروع على 5 أحرف على الأقل"),
  date: z.string({
    required_error: "تاريخ المشروع مطلوب",
    invalid_type_error: "يجب أن يكون التاريخ نصاً"
  }).refine(
    (date) => {
      const isISODateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(date);
      const isSimpleDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
      const isValidDate = !isNaN(Date.parse(date));
      return (isISODateTime || isSimpleDate) && isValidDate;
    }, { message: "يجب أن يكون التاريخ بتنسيق صحيح (YYYY-MM-DD أو YYYY-MM-DDTHH:mm:ss.sssZ)" }
  ),
  amounts: AmountsSchema,
  isForOrphans: z.boolean(),
  beneficiariesList: z.array(
    z.number().int("يجب أن يكون معرف المستفيد عددًا صحيحًا").positive("يجب أن يكون رقم هوية المستفيد إيجابيا"),
  ),
});

export const createProjectSchema = projectSchema;
export const updateProjectSchema = projectSchema
  .omit({ isForOrphans: true })
  .extend({
    id: z.union([
      z.string().transform((val) => parseInt(val)),
      z.number()
    ]).refine(val => val !== undefined && val !== null, {
      message: "معرف المشروع مطلوب"
    })
  });

// ***** END PROJECTS VALIDATIN FUNCTIONS ***** //
