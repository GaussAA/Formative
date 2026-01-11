/**
 * Server Actions for Requirement Form Submission
 *
 * React 19 Server Actions provide a streamlined way to handle form submissions
 * with automatic type safety, CSRF protection, and progressive enhancement.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import { Stage } from '@/types';
import { formValidatorNode } from '@/lib/agents/form-validator';
import logger from '@/lib/logger';
import type { RequirementProfile, OptionChip } from '@/types';

/**
 * Form state for useActionState
 */
export interface RequirementFormState {
  success: boolean;
  errors?: Record<string, string[]>;
  message?: string;
  sessionId?: string;
  response?: string;
  options?: OptionChip[];
  currentStage?: Stage;
  completeness?: number;
  profile?: RequirementProfile;
}

/**
 * Submit requirement form using Server Action
 *
 * This action can be called directly from form components using useActionState.
 * It provides automatic type safety, CSRF protection, and better UX.
 *
 * @param prevState - Previous form state (for useActionState)
 * @param formData - Form data from the form element
 * @returns Updated form state
 *
 * @example
 * ```tsx
 * import { useActionState } from 'react';
 * import { submitRequirementForm } from '@/app/actions/requirement-actions';
 *
 * export function FormComponent() {
 *   const [state, formAction, isPending] = useActionState(submitRequirementForm, null);
 *   return <form action={formAction}>...</form>;
 * }
 * ```
 */
export async function submitRequirementForm(
  prevState: RequirementFormState | null,
  formData: FormData
): Promise<RequirementFormState> {
  try {
    // Extract form data
    const profile: RequirementProfile = {
      projectName: formData.get('projectName') as string | undefined,
      productGoal: formData.get('productGoal') as string,
      targetUsers: formData.get('targetUsers') as string,
      useCases: formData.get('useCases') as string | undefined,
      coreFunctions: formData.getAll('coreFunctions') as string[],
      needsDataStorage: formData.get('needsDataStorage') === 'true',
      needsMultiUser: formData.get('needsMultiUser') === 'true',
      needsAuth: formData.get('needsAuth') === 'true',
    };

    // Validate required fields
    const errors: Record<string, string[]> = {};

    if (!profile.productGoal || profile.productGoal.trim().length < 10) {
      errors.productGoal = ['产品目标至少需要 10 个字符'];
    }

    if (!profile.targetUsers || profile.targetUsers.trim().length < 2) {
      errors.targetUsers = ['目标用户不能为空'];
    }

    if (!profile.coreFunctions || profile.coreFunctions.length === 0) {
      errors.coreFunctions = ['至少添加一个核心功能'];
    }

    // If there are validation errors, return them
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        message: '请检查表单中的错误',
      };
    }

    // Generate session ID
    const sessionId = uuidv4();

    logger.info('Server Action: Form submission received', { sessionId, profile });

    // Call form validator node
    const validatorResult = await formValidatorNode({
      sessionId,
      userInput: '',
      currentStage: Stage.REQUIREMENT_COLLECTION,
      completeness: 0,
      profile,
      summary: {},
      messages: [],
      needMoreInfo: false,
      missingFields: [],
      askedQuestions: [],
      stop: false,
      response: '',
      options: undefined,
      nextQuestion: undefined,
      finalSpec: undefined,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    logger.info('Server Action: Form validation completed', {
      sessionId,
      currentStage: validatorResult.currentStage,
      needMoreInfo: validatorResult.needMoreInfo,
    });

    // Revalidate the app page to show updated data
    revalidatePath('/app');

    // Return success state
    return {
      success: true,
      sessionId,
      response: validatorResult.response || '表单已提交，正在处理...',
      options: validatorResult.options || [],
      currentStage: validatorResult.currentStage,
      completeness: validatorResult.completeness || 0,
      profile,
      message: '需求已成功提交',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Server Action: Form submission error', {
      error: errorMessage,
      stack: errorStack,
    });

    return {
      success: false,
      message: '表单处理失败，请稍后重试',
      errors: {
        form: [process.env.NODE_ENV === 'development' ? errorMessage : '提交失败'],
      },
    };
  }
}

/**
 * Alternative: Submit requirement form as JSON
 * For cases where you have the profile object already constructed
 *
 * @param prevState - Previous form state
 * @param profile - Requirement profile object
 * @returns Updated form state
 */
export async function submitRequirementProfile(
  prevState: RequirementFormState | null,
  profile: RequirementProfile
): Promise<RequirementFormState> {
  try {
    // Validate required fields
    const errors: Record<string, string[]> = {};

    if (!profile.productGoal || profile.productGoal.trim().length < 10) {
      errors.productGoal = ['产品目标至少需要 10 个字符'];
    }

    if (!profile.targetUsers || profile.targetUsers.trim().length < 2) {
      errors.targetUsers = ['目标用户不能为空'];
    }

    if (!profile.coreFunctions || profile.coreFunctions.length === 0) {
      errors.coreFunctions = ['至少添加一个核心功能'];
    }

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        message: '请检查表单中的错误',
      };
    }

    const sessionId = uuidv4();

    logger.info('Server Action: Profile submission received', { sessionId, profile });

    const validatorResult = await formValidatorNode({
      sessionId,
      userInput: '',
      currentStage: Stage.REQUIREMENT_COLLECTION,
      completeness: 0,
      profile,
      summary: {},
      messages: [],
      needMoreInfo: false,
      missingFields: [],
      askedQuestions: [],
      stop: false,
      response: '',
      options: undefined,
      nextQuestion: undefined,
      finalSpec: undefined,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    logger.info('Server Action: Profile validation completed', {
      sessionId,
      currentStage: validatorResult.currentStage,
    });

    revalidatePath('/app');

    return {
      success: true,
      sessionId,
      response: validatorResult.response || '表单已提交',
      options: validatorResult.options || [],
      currentStage: validatorResult.currentStage,
      completeness: validatorResult.completeness || 0,
      profile,
      message: '需求已成功提交',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Server Action: Profile submission error', {
      error: errorMessage,
    });

    return {
      success: false,
      message: '表单处理失败，请稍后重试',
      errors: {
        form: [process.env.NODE_ENV === 'development' ? errorMessage : '提交失败'],
      },
    };
  }
}
