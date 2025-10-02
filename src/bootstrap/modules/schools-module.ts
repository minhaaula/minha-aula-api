import { ModuleBuildResult, ModuleSetupContext } from './types';
import { SchoolRepositoryAdapter } from '../../infra/db/typeorm/school-repository.adap';
import { CourseRepositoryAdapter } from '../../infra/db/typeorm/course-repository.adap';
import { CourseClassRepositoryAdapter } from '../../infra/db/typeorm/course-class-repository.adap';
import { CreateSchool } from '../../app/use-cases/create-school';
import { CreateCourse } from '../../app/use-cases/create-course';
import { CreateCourseClass } from '../../app/use-cases/create-course-class';
import { ListSchools } from '../../app/use-cases/list-schools';
import { schoolsRouter } from '../../infra/http/routes/schools.routes';

export type SchoolsModuleDeps = {
    schoolsRepo: SchoolRepositoryAdapter;
    coursesRepo: CourseRepositoryAdapter;
    classesRepo: CourseClassRepositoryAdapter;
};

export function buildSchoolsModule(deps: SchoolsModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
    const createSchool = new CreateSchool(deps.schoolsRepo);
    const listSchools = new ListSchools(deps.schoolsRepo);
    const createCourse = new CreateCourse(deps.schoolsRepo, deps.coursesRepo);
    const createCourseClass = new CreateCourseClass(deps.coursesRepo, deps.classesRepo);

    return {
        deps: {
            schoolsRouter,
            createSchool,
            listSchools,
            createCourse,
            createCourseClass
        },
        docFiles: ['schools.yaml']
    };
}
