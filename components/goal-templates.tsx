"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Code, Briefcase, Heart, Target, TrendingUp } from 'lucide-react'

interface GoalTemplate {
  id: string
  title: string
  description: string
  goal: string
  duration: string
  difficulty: '入门' | '中级' | '高级'
  tags: string[]
  icon: React.ReactNode
}

interface GoalCategory {
  id: string
  name: string
  icon: React.ReactNode
  templates: GoalTemplate[]
}

const goalCategories: GoalCategory[] = [
  {
    id: 'tech',
    name: '技术技能',
    icon: <Code className="w-5 h-5" />,
    templates: [
      {
        id: 'fullstack',
        title: '全栈开发工程师',
        description: '掌握前后端开发技术，成为全栈工程师',
        goal: '在6个月内精通React前端开发和Node.js后端开发，能够独立设计和开发完整的Web应用，包括用户认证、数据库设计、API开发和部署',
        duration: '6个月',
        difficulty: '中级',
        tags: ['React', 'Node.js', '全栈', 'Web开发'],
        icon: <Code className="w-4 h-4" />
      },
      {
        id: 'ai-ml',
        title: 'AI/机器学习入门',
        description: '从零开始学习人工智能和机器学习',
        goal: '用3个月时间学习Python编程和机器学习基础，掌握数据预处理、模型训练和评估，完成至少3个实战项目',
        duration: '3个月',
        difficulty: '入门',
        tags: ['Python', 'AI', '机器学习', '数据科学'],
        icon: <TrendingUp className="w-4 h-4" />
      },
      {
        id: 'mobile-dev',
        title: '移动应用开发',
        description: '学习开发iOS和Android应用',
        goal: '4个月内掌握Flutter跨平台开发，完成一个包含用户系统、实时数据同步和推送通知的移动应用并上架应用商店',
        duration: '4个月',
        difficulty: '中级',
        tags: ['Flutter', '移动开发', 'iOS', 'Android'],
        icon: <Target className="w-4 h-4" />
      }
    ]
  },
  {
    id: 'career',
    name: '职业发展',
    icon: <Briefcase className="w-5 h-5" />,
    templates: [
      {
        id: 'product-manager',
        title: '产品经理转型',
        description: '系统学习产品管理知识和技能',
        goal: '用4个月时间掌握产品规划、用户研究、需求分析、项目管理等核心技能，完成3个产品案例分析，准备产品经理面试',
        duration: '4个月',
        difficulty: '中级',
        tags: ['产品管理', '职业转型', '用户研究'],
        icon: <Briefcase className="w-4 h-4" />
      },
      {
        id: 'data-analyst',
        title: '数据分析师',
        description: '成为专业的数据分析师',
        goal: '5个月内精通SQL、Python数据分析和可视化工具，掌握统计学基础和商业分析方法，完成5个真实数据集的分析项目',
        duration: '5个月',
        difficulty: '中级',
        tags: ['数据分析', 'SQL', 'Python', '可视化'],
        icon: <TrendingUp className="w-4 h-4" />
      }
    ]
  },
  {
    id: 'personal',
    name: '个人成长',
    icon: <Heart className="w-5 h-5" />,
    templates: [
      {
        id: 'language',
        title: '英语流利说',
        description: '提升英语口语和听力能力',
        goal: '用6个月时间将英语从中级提升到高级水平，能够流利进行商务对话，通过雅思口语7分或托福口语26分',
        duration: '6个月',
        difficulty: '中级',
        tags: ['英语', '语言学习', '口语'],
        icon: <BookOpen className="w-4 h-4" />
      },
      {
        id: 'writing',
        title: '写作能力提升',
        description: '成为优秀的内容创作者',
        goal: '3个月内建立写作习惯，每周产出2篇高质量文章，在知乎或公众号积累1000+粉丝，掌握不同文体的写作技巧',
        duration: '3个月',
        difficulty: '入门',
        tags: ['写作', '内容创作', '自媒体'],
        icon: <BookOpen className="w-4 h-4" />
      }
    ]
  }
]

interface GoalTemplatesProps {
  onSelectGoal: (goal: string) => void
}

export default function GoalTemplates({ onSelectGoal }: GoalTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('tech')
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null)
  
  const currentCategory = goalCategories.find(cat => cat.id === selectedCategory)
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case '入门':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case '中级':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case '高级':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default:
        return ''
    }
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">选择学习方向</h3>
        <div className="flex gap-2">
          {goalCategories.map(category => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="flex items-center gap-2"
            >
              {category.icon}
              {category.name}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="grid gap-4">
        {currentCategory?.templates.map(template => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all ${
              hoveredTemplate === template.id 
                ? 'shadow-lg border-blue-500 dark:border-blue-400' 
                : 'hover:shadow-md'
            }`}
            onMouseEnter={() => setHoveredTemplate(template.id)}
            onMouseLeave={() => setHoveredTemplate(null)}
            onClick={() => onSelectGoal(template.goal)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    {template.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{template.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {template.description}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={getDifficultyColor(template.difficulty)}>
                  {template.difficulty}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">学习目标：</span>
                  {template.goal}
                </p>
                
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    预计时长：<span className="font-medium text-gray-700 dark:text-gray-300">{template.duration}</span>
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {template.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {hoveredTemplate === template.id && (
                <div className="mt-4 pt-4 border-t">
                  <Button className="w-full" size="sm" onClick={(e) => { e.stopPropagation(); onSelectGoal(template.goal); }}>
                    使用这个模板开始学习
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="text-center py-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          没有找到合适的模板？
        </p>
        <Button variant="link" onClick={() => onSelectGoal('')}>
          自定义学习目标
        </Button>
      </div>
    </div>
  )
}
